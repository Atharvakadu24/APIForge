import http from 'http';
import https from 'https';
import type { ExecuteRequestPayload, ExecuteResponsePayload } from '../types/execution';
import { SSRFValidator, SSRFSecurityError } from './ssrfValidator';

const MAX_REDIRECTS = 5;

// Dedicated security agents with socket-level DNS lookup validation
const ssrfLookupHook = SSRFValidator.createSsrfSafeLookup();

const httpAgent = new http.Agent({
  lookup: ssrfLookupHook,
  keepAlive: true,
  maxSockets: 50,
});

const httpsAgent = new https.Agent({
  lookup: ssrfLookupHook,
  keepAlive: true,
  maxSockets: 50,
});

interface InternalHttpResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  location?: string;
}

export class RequestExecutorService {
  /**
   * Dispatches a single HTTP/HTTPS request over a secure agent with optional AbortSignal.
   */
  private static executeSingleRequest(
    targetUrl: URL,
    method: string,
    headers: Record<string, string>,
    body: string | Buffer | undefined,
    timeoutMs: number,
    signal?: AbortSignal
  ): Promise<InternalHttpResponse> {
    return new Promise((resolve, reject) => {
      let isSettled = false;
      let activeRes: http.IncomingMessage | null = null;
      let req: http.ClientRequest;

      const isHttps = targetUrl.protocol === 'https:';
      const requestFn = isHttps ? https.request : http.request;
      const agent = isHttps ? httpsAgent : httpAgent;

      const options: https.RequestOptions = {
        protocol: targetUrl.protocol,
        hostname: targetUrl.hostname,
        port: targetUrl.port || (isHttps ? 443 : 80),
        path: `${targetUrl.pathname}${targetUrl.search}`,
        method: method.toUpperCase(),
        headers: headers,
        agent: agent,
      };

      const cleanup = () => {
        clearTimeout(timer);
        if (signal && onAbort) {
          signal.removeEventListener('abort', onAbort);
        }
      };

      const timer = setTimeout(() => {
        if (!isSettled) {
          isSettled = true;
          cleanup();
          const timeoutErr = new SSRFSecurityError(`Request timed out after ${timeoutMs}ms.`, 'TIMEOUT');
          if (activeRes) {
            activeRes.destroy(timeoutErr);
          }
          if (req) {
            req.destroy(timeoutErr);
          }
          reject(timeoutErr);
        }
      }, timeoutMs);

      const onAbort = () => {
        if (!isSettled) {
          isSettled = true;
          cleanup();
          const abortErr = new Error('Request aborted by client');
          abortErr.name = 'AbortError';
          if (activeRes) {
            activeRes.destroy(abortErr);
          }
          if (req) {
            req.destroy(abortErr);
          }
          reject(abortErr);
        }
      };

      if (signal) {
        if (signal.aborted) {
          onAbort();
          return;
        }
        signal.addEventListener('abort', onAbort);
      }

      req = requestFn(options, (res) => {
        activeRes = res;
        const responseHeaders: Record<string, string> = {};
        for (const [key, val] of Object.entries(res.headers)) {
          if (Array.isArray(val)) {
            responseHeaders[key.toLowerCase()] = val.join(', ');
          } else if (typeof val === 'string') {
            responseHeaders[key.toLowerCase()] = val;
          }
        }

        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));

        res.on('end', () => {
          if (isSettled) return;
          isSettled = true;
          cleanup();
          const responseBody = Buffer.concat(chunks).toString('utf8');
          resolve({
            status: res.statusCode || 200,
            statusText: res.statusMessage || (res.statusCode && res.statusCode < 400 ? 'OK' : 'Error'),
            headers: responseHeaders,
            body: responseBody,
            location: responseHeaders['location'],
          });
        });

        res.on('error', (err) => {
          if (isSettled) return;
          isSettled = true;
          cleanup();
          reject(err);
        });
      });

      req.on('error', (err) => {
        if (isSettled) return;
        isSettled = true;
        cleanup();
        reject(err);
      });

      if (body && method !== 'GET' && method !== 'HEAD') {
        req.write(body);
      }

      req.end();
    });
  }

  /**
   * Executes an incoming request against the target API with SSRF defense, manual redirect verification, and AbortSignal support.
   */
  public static async execute(payload: ExecuteRequestPayload, signal?: AbortSignal): Promise<ExecuteResponsePayload> {
    const startTime = performance.now();

    try {
      if (signal?.aborted) {
        const abortErr = new Error('Request aborted by client');
        abortErr.name = 'AbortError';
        throw abortErr;
      }

      // 1. Initial URL Validation & Parsing
      let currentUrl = SSRFValidator.validateUrlProtocolAndFormat(payload.url);

      // 2. Merge Initial Query Parameters (avoid duplicate appending if already in URL)
      if (Array.isArray(payload.queryParams)) {
        const hasExistingQuery = currentUrl.search && currentUrl.search.length > 1;
        if (!hasExistingQuery) {
          for (const param of payload.queryParams) {
            if (param.enabled && param.key && param.key.trim()) {
              currentUrl.searchParams.append(param.key.trim(), param.value || '');
            }
          }
        }
      }

      // Query param Auth injection
      if (
        payload.auth?.type === 'apiKey' &&
        payload.auth.apiKey?.addTo === 'query' &&
        payload.auth.apiKey.key?.trim()
      ) {
        const authKey = payload.auth.apiKey.key.trim();
        if (!currentUrl.searchParams.has(authKey)) {
          currentUrl.searchParams.append(
            authKey,
            payload.auth.apiKey.value || ''
          );
        }
      }

      // 3. Pre-flight DNS & Hostname Validation
      await SSRFValidator.validateDestination(currentUrl);

      // 4. Assemble Initial Request Headers
      let requestHeaders: Record<string, string> = {
        'Accept': '*/*',
        'User-Agent': 'APIForge-Proxy/1.0',
      };

      if (Array.isArray(payload.headers)) {
        for (const header of payload.headers) {
          if (header.enabled && header.key && header.key.trim()) {
            requestHeaders[header.key.trim()] = header.value || '';
          }
        }
      }

      // Auth Headers injection
      if (payload.auth?.type === 'bearer' && payload.auth.bearer?.token) {
        requestHeaders['Authorization'] = `Bearer ${payload.auth.bearer.token}`;
      } else if (
        payload.auth?.type === 'apiKey' &&
        payload.auth.apiKey?.addTo === 'header' &&
        payload.auth.apiKey.key?.trim()
      ) {
        requestHeaders[payload.auth.apiKey.key.trim()] = payload.auth.apiKey.value || '';
      }

      // 5. Assemble Initial Request Body based on bodyType
      let currentMethod = (payload.method || 'GET').toUpperCase();
      let currentBody: string | Buffer | undefined = undefined;

      const hasContentType = Object.keys(requestHeaders).some(
        (k) => k.toLowerCase() === 'content-type'
      );

      if (currentMethod !== 'GET' && currentMethod !== 'HEAD') {
        if (payload.bodyType === 'json') {
          if (payload.body && payload.body.length > 0) {
            currentBody = payload.body;
            requestHeaders['Content-Length'] = Buffer.byteLength(currentBody, 'utf8').toString();
          }
          if (!hasContentType) {
            requestHeaders['Content-Type'] = 'application/json';
          }
        } else if (payload.bodyType === 'text') {
          if (payload.body && payload.body.length > 0) {
            currentBody = payload.body;
            requestHeaders['Content-Length'] = Buffer.byteLength(currentBody, 'utf8').toString();
          }
          if (!hasContentType) {
            requestHeaders['Content-Type'] = 'text/plain';
          }
        } else if (payload.bodyType === 'x-www-form-urlencoded') {
          const params = new URLSearchParams();
          if (Array.isArray(payload.formUrlEncoded)) {
            for (const entry of payload.formUrlEncoded) {
              if (entry.enabled && entry.key && entry.key.trim()) {
                params.append(entry.key.trim(), entry.value || '');
              }
            }
          }
          const urlencodedStr = params.toString();
          currentBody = Buffer.from(urlencodedStr, 'utf8');
          requestHeaders['Content-Length'] = currentBody.length.toString();

          // Ensure form-urlencoded Content-Type always overrides any existing or default Content-Type header
          for (const k of Object.keys(requestHeaders)) {
            if (k.toLowerCase() === 'content-type') {
              delete requestHeaders[k];
            }
          }
          requestHeaders['Content-Type'] = 'application/x-www-form-urlencoded; charset=UTF-8';
        } else if (payload.bodyType === 'multipart/form-data') {
          const formData = new FormData();
          if (Array.isArray(payload.multipartFormData)) {
            for (const field of payload.multipartFormData) {
              if (field.enabled && field.key && field.key.trim()) {
                formData.append(field.key.trim(), field.value || '');
              }
            }
          }
          // Build request via runtime fetch/Request to generate multipart boundary
          const tempReq = new Request('http://localhost', {
            method: 'POST',
            body: formData,
          });
          const runtimeContentType = tempReq.headers.get('content-type') || 'multipart/form-data';

          // Runtime-generated Content-Type including its boundary always takes precedence
          for (const k of Object.keys(requestHeaders)) {
            if (k.toLowerCase() === 'content-type') {
              delete requestHeaders[k];
            }
          }
          requestHeaders['Content-Type'] = runtimeContentType;

          const arrayBuf = await tempReq.arrayBuffer();
          currentBody = Buffer.from(arrayBuf);
          requestHeaders['Content-Length'] = currentBody.length.toString();
        }
      }

      const timeoutMs = Math.min(Math.max(payload.timeoutMs || 30000, 1000), 60000);

      // 6. Execute Request with Manual Redirect Validation Loop
      let redirectHops = 0;
      let finalResponse: InternalHttpResponse | null = null;

      while (redirectHops <= MAX_REDIRECTS) {
        // Set Host header explicitly for target
        requestHeaders['Host'] = currentUrl.host;

        const response = await this.executeSingleRequest(
          currentUrl,
          currentMethod,
          requestHeaders,
          currentBody,
          timeoutMs,
          signal
        );

        const isRedirectStatus = [301, 302, 303, 307, 308].includes(response.status);

        if (isRedirectStatus && response.location) {
          redirectHops++;
          if (redirectHops > MAX_REDIRECTS) {
            throw new SSRFSecurityError(
              `Maximum redirect limit of ${MAX_REDIRECTS} exceeded.`,
              'TOO_MANY_REDIRECTS',
              currentUrl.toString()
            );
          }

          // Parse and resolve redirect location
          let nextUrl: URL;
          try {
            nextUrl = new URL(response.location, currentUrl.toString());
          } catch {
            throw new SSRFSecurityError(
              `Invalid redirect location URL: "${response.location}"`,
              'INVALID_REDIRECT',
              currentUrl.toString()
            );
          }

          // Validate redirect protocol, hostname, and destination
          try {
            SSRFValidator.validateUrlProtocolAndFormat(nextUrl.toString());
            await SSRFValidator.validateDestination(nextUrl);
          } catch (err: any) {
            throw new SSRFSecurityError(
              `Redirect target "${nextUrl.toString()}" was blocked for security: ${err.message}`,
              'SSRF_REDIRECT_BLOCKED',
              currentUrl.toString(),
              nextUrl.hostname
            );
          }

          // Cross-Origin header sanitation (strip Authorization / API keys if origin changes)
          if (nextUrl.origin !== currentUrl.origin) {
            delete requestHeaders['Authorization'];
            delete requestHeaders['authorization'];
            if (payload.auth?.type === 'apiKey' && payload.auth.apiKey?.key) {
              delete requestHeaders[payload.auth.apiKey.key];
            }
          }

          // Adjust HTTP Method and Body for redirects per RFC semantics
          if (response.status === 303 || ((response.status === 301 || response.status === 302) && currentMethod === 'POST')) {
            currentMethod = 'GET';
            currentBody = undefined;
            delete requestHeaders['Content-Type'];
            delete requestHeaders['content-type'];
            delete requestHeaders['Content-Length'];
            delete requestHeaders['content-length'];
          }

          currentUrl = nextUrl;
          continue;
        }

        // Not a redirect or no location header: this is the final response
        finalResponse = response;
        break;
      }

      if (!finalResponse) {
        throw new Error('Failed to retrieve response from target server.');
      }

      const endTime = performance.now();
      const latency = Math.round(endTime - startTime);
      const responseSize = Buffer.byteLength(finalResponse.body, 'utf8');

      return {
        status: finalResponse.status,
        statusText: finalResponse.statusText,
        headers: finalResponse.headers,
        time: latency,
        size: responseSize,
        body: finalResponse.body,
        isError: finalResponse.status >= 400,
      };
    } catch (err: any) {
      const endTime = performance.now();
      const latency = Math.round(endTime - startTime);

      // SSRF Security Blocked (Direct or Redirect)
      if (
        err.code === 'SSRF_BLOCKED' ||
        err.code === 'SSRF_REDIRECT_BLOCKED' ||
        err.code === 'INVALID_PROTOCOL' ||
        err.code === 'INVALID_URL' ||
        err.code === 'INVALID_REDIRECT' ||
        err.code === 'TOO_MANY_REDIRECTS'
      ) {
        const errorPayload = {
          error: err.code === 'SSRF_REDIRECT_BLOCKED' ? 'Blocked Redirect Target' : 'SSRF Security Violation',
          code: err.code,
          message: err.message || 'Access to the requested destination is blocked for security.',
          target: err.target || payload.url,
          blockedAddress: err.blockedAddress,
        };
        const errorBody = JSON.stringify(errorPayload, null, 2);

        return {
          status: 400,
          statusText: 'Bad Request (Security Violation)',
          headers: { 'content-type': 'application/json' },
          time: latency,
          size: Buffer.byteLength(errorBody, 'utf8'),
          body: errorBody,
          isError: true,
          errorMessage: errorPayload.message,
        };
      }

      // Client cancellation / abort
      if (signal?.aborted || err.name === 'AbortError') {
        const errorPayload = {
          error: 'Client Cancelled',
          code: 'ABORTED',
          message: 'The request was cancelled by the client.',
        };
        const errorBody = JSON.stringify(errorPayload, null, 2);

        return {
          status: 499,
          statusText: 'Client Closed Request',
          headers: { 'content-type': 'application/json' },
          time: latency,
          size: Buffer.byteLength(errorBody, 'utf8'),
          body: errorBody,
          isError: true,
          errorMessage: errorPayload.message,
        };
      }

      // Timeout detection
      if (err.code === 'TIMEOUT' || err.name === 'TimeoutError') {
        const errorPayload = {
          error: 'Gateway Timeout',
          code: 'TIMEOUT',
          message: `The target server failed to respond within ${payload.timeoutMs || 30000}ms.`,
          suggestion: 'Check if the target server is active and reachable, or increase the timeout duration.',
        };
        const errorBody = JSON.stringify(errorPayload, null, 2);

        return {
          status: 504,
          statusText: 'Gateway Timeout',
          headers: { 'content-type': 'application/json' },
          time: latency,
          size: Buffer.byteLength(errorBody, 'utf8'),
          body: errorBody,
          isError: true,
          errorMessage: errorPayload.message,
        };
      }

      // DNS Resolution Failure
      if (err.code === 'DNS_LOOKUP_FAILED' || err.code === 'ENOTFOUND') {
        const errorPayload = {
          error: 'DNS Lookup Failed',
          code: 'DNS_LOOKUP_FAILED',
          message: err.message || 'Could not resolve destination hostname.',
          target: payload.url,
        };
        const errorBody = JSON.stringify(errorPayload, null, 2);

        return {
          status: 502,
          statusText: 'Bad Gateway (DNS Failure)',
          headers: { 'content-type': 'application/json' },
          time: latency,
          size: Buffer.byteLength(errorBody, 'utf8'),
          body: errorBody,
          isError: true,
          errorMessage: errorPayload.message,
        };
      }

      // General Network Connection Failure
      const errorCode = err.cause?.code || err.code || 'CONNECTION_FAILED';
      const errorPayload = {
        error: 'Network Error',
        code: errorCode,
        message: err.message || 'Failed to connect to the target endpoint.',
        target: payload.url,
      };
      const errorBody = JSON.stringify(errorPayload, null, 2);

      return {
        status: 502,
        statusText: 'Bad Gateway',
        headers: { 'content-type': 'application/json' },
        time: latency,
        size: Buffer.byteLength(errorBody, 'utf8'),
        body: errorBody,
        isError: true,
        errorMessage: errorPayload.message,
      };
    }
  }
}
