import type { ExecuteRequestPayload, ExecuteResponsePayload } from '../types/execution';

// Blocked hostnames / IP addresses for SSRF protection
const BLOCKED_HOSTS = new Set([
  '169.254.169.254',             // AWS / GCP / Azure Instance Metadata Service
  'metadata.google.internal',    // GCP Metadata server
  'metadata.azure.internal',     // Azure Metadata server
  '100.100.100.200',             // Alibaba Cloud Metadata server
]);

export class RequestExecutorService {
  /**
   * Validates target URL and checks for security/SSRF risks.
   */
  private static validateUrl(rawUrl: string): URL {
    if (!rawUrl || typeof rawUrl !== 'string' || !rawUrl.trim()) {
      throw new Error('URL cannot be empty');
    }

    let parsedUrl: URL;
    try {
      // If user forgot protocol, default to http://
      if (!/^https?:\/\//i.test(rawUrl.trim())) {
        parsedUrl = new URL(`http://${rawUrl.trim()}`);
      } else {
        parsedUrl = new URL(rawUrl.trim());
      }
    } catch {
      throw new Error(`Invalid URL format: "${rawUrl}"`);
    }

    // Protocol check: only http and https are allowed
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      throw new Error(`Unsupported protocol "${parsedUrl.protocol}". Only HTTP and HTTPS are permitted.`);
    }

    // SSRF link-local & cloud metadata check
    const hostname = parsedUrl.hostname.toLowerCase();
    if (BLOCKED_HOSTS.has(hostname) || hostname.startsWith('169.254.')) {
      throw new Error(`Access to link-local/cloud metadata host "${hostname}" is blocked for security.`);
    }

    return parsedUrl;
  }

  /**
   * Executes an incoming request against the target API and returns structured metrics.
   */
  public static async execute(payload: ExecuteRequestPayload): Promise<ExecuteResponsePayload> {
    const startTime = performance.now();

    try {
      // 1. Validate & Parse URL
      const targetUrl = this.validateUrl(payload.url);

      // 2. Merge Query Parameters
      if (Array.isArray(payload.queryParams)) {
        for (const param of payload.queryParams) {
          if (param.enabled && param.key && param.key.trim()) {
            targetUrl.searchParams.append(param.key.trim(), param.value || '');
          }
        }
      }

      // Query param Auth injection
      if (
        payload.auth?.type === 'apiKey' &&
        payload.auth.apiKey?.addTo === 'query' &&
        payload.auth.apiKey.key?.trim()
      ) {
        targetUrl.searchParams.append(
          payload.auth.apiKey.key.trim(),
          payload.auth.apiKey.value || ''
        );
      }

      // 3. Assemble Request Headers
      const requestHeaders: Record<string, string> = {};

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

      // Default Content-Type if missing when body is present
      const hasContentType = Object.keys(requestHeaders).some(
        (k) => k.toLowerCase() === 'content-type'
      );

      if (!hasContentType) {
        if (payload.bodyType === 'json' && payload.body?.trim()) {
          requestHeaders['Content-Type'] = 'application/json';
        } else if (payload.bodyType === 'text' && payload.body?.trim()) {
          requestHeaders['Content-Type'] = 'text/plain';
        }
      }

      // 4. Assemble Request Body
      const upperMethod = (payload.method || 'GET').toUpperCase();
      let requestBody: string | undefined = undefined;

      if (upperMethod !== 'GET' && upperMethod !== 'HEAD') {
        if (payload.bodyType !== 'none' && payload.body && payload.body.length > 0) {
          requestBody = payload.body;
        }
      }

      // 5. Configure Timeout & Dispatch
      const timeoutMs = Math.min(Math.max(payload.timeoutMs || 30000, 1000), 60000);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      let response: Response;
      try {
        response = await fetch(targetUrl.toString(), {
          method: upperMethod,
          headers: requestHeaders,
          body: requestBody,
          signal: controller.signal,
          redirect: 'follow',
        });
      } finally {
        clearTimeout(timeoutId);
      }

      const responseText = await response.text();
      const endTime = performance.now();
      const latency = Math.round(endTime - startTime);
      const responseSize = Buffer.byteLength(responseText, 'utf8');

      // Normalize response headers
      const responseHeadersDict: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeadersDict[key] = value;
      });

      return {
        status: response.status,
        statusText: response.statusText || (response.ok ? 'OK' : 'Error'),
        headers: responseHeadersDict,
        time: latency,
        size: responseSize,
        body: responseText,
        isError: !response.ok,
      };
    } catch (err: any) {
      const endTime = performance.now();
      const latency = Math.round(endTime - startTime);

      // Timeout detection
      if (err.name === 'AbortError' || err.name === 'TimeoutError') {
        const errorPayload = {
          error: 'Gateway Timeout',
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

      // URL Validation or SSRF Blocked
      if (err.message && (err.message.includes('blocked for security') || err.message.includes('Invalid URL') || err.message.includes('URL cannot be empty'))) {
        const errorPayload = {
          error: 'Bad Request',
          message: err.message,
        };
        const errorBody = JSON.stringify(errorPayload, null, 2);
        return {
          status: 400,
          statusText: 'Bad Request',
          headers: { 'content-type': 'application/json' },
          time: latency,
          size: Buffer.byteLength(errorBody, 'utf8'),
          body: errorBody,
          isError: true,
          errorMessage: err.message,
        };
      }

      // Network / Connection errors (DNS failure, Connection refused, etc.)
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
