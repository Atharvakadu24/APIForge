import { Router, Request, Response } from 'express';
import { RequestExecutorService } from '../services/requestExecutor';
import { requireAuth } from '../middleware/authMiddleware';
import type { ExecuteRequestPayload, ExecuteResponsePayload } from '../types/execution';

export const executeRouter = Router();

/**
 * Allowlist mapping of recognized execution and security error codes
 * to safe, standardized HTTP status codes and non-leaking client messages.
 */
interface SafeErrorInfo {
  statusCode: number;
  statusText: string;
  errorCode: string;
  message: string;
}

const KNOWN_ERROR_ALLOWLIST: Record<string, SafeErrorInfo> = {
  INVALID_URL: {
    statusCode: 400,
    statusText: 'Bad Request',
    errorCode: 'INVALID_URL',
    message: 'Invalid URL format.',
  },
  INVALID_PROTOCOL: {
    statusCode: 400,
    statusText: 'Bad Request',
    errorCode: 'INVALID_PROTOCOL',
    message: 'Unsupported protocol. Only HTTP and HTTPS are permitted.',
  },
  SSRF_BLOCKED: {
    statusCode: 400,
    statusText: 'Bad Request (Security Violation)',
    errorCode: 'SSRF_BLOCKED',
    message: 'Access to the requested destination is blocked for security.',
  },
  SSRF_REDIRECT_BLOCKED: {
    statusCode: 400,
    statusText: 'Bad Request (Security Violation)',
    errorCode: 'SSRF_REDIRECT_BLOCKED',
    message: 'Redirect target was blocked for security.',
  },
  INVALID_REDIRECT: {
    statusCode: 400,
    statusText: 'Bad Request (Security Violation)',
    errorCode: 'INVALID_REDIRECT',
    message: 'Invalid redirect location URL.',
  },
  TOO_MANY_REDIRECTS: {
    statusCode: 400,
    statusText: 'Bad Request (Security Violation)',
    errorCode: 'TOO_MANY_REDIRECTS',
    message: 'Maximum redirect limit exceeded.',
  },
  RESPONSE_TOO_LARGE: {
    statusCode: 413,
    statusText: 'Payload Too Large',
    errorCode: 'RESPONSE_TOO_LARGE',
    message: 'Response size exceeded maximum allowed limit of 10MB.',
  },
  ABORTED: {
    statusCode: 499,
    statusText: 'Client Closed Request',
    errorCode: 'ABORTED',
    message: 'The request was cancelled by the client.',
  },
  TIMEOUT: {
    statusCode: 504,
    statusText: 'Gateway Timeout',
    errorCode: 'TIMEOUT',
    message: 'The target server failed to respond within the allowed timeout period.',
  },
  DNS_LOOKUP_FAILED: {
    statusCode: 502,
    statusText: 'Bad Gateway (DNS Failure)',
    errorCode: 'DNS_LOOKUP_FAILED',
    message: 'Could not resolve destination hostname.',
  },
  ENOTFOUND: {
    statusCode: 502,
    statusText: 'Bad Gateway (DNS Failure)',
    errorCode: 'DNS_LOOKUP_FAILED',
    message: 'Could not resolve destination hostname.',
  },
  CONNECTION_FAILED: {
    statusCode: 502,
    statusText: 'Bad Gateway',
    errorCode: 'CONNECTION_FAILED',
    message: 'Failed to connect to the target endpoint.',
  },
  ECONNREFUSED: {
    statusCode: 502,
    statusText: 'Bad Gateway',
    errorCode: 'CONNECTION_FAILED',
    message: 'Failed to connect to the target endpoint.',
  },
  ECONNRESET: {
    statusCode: 502,
    statusText: 'Bad Gateway',
    errorCode: 'CONNECTION_FAILED',
    message: 'Connection closed unexpectedly by upstream target.',
  },
};

/**
 * Constructs a safe, normalized response envelope for client/security failures.
 * Never leaks raw error messages, stack traces, internal paths, or query parameters.
 */
function buildSanitizedErrorEnvelope(
  err: any,
  fallbackStatus = 500
): { httpStatus: number; payload: ExecuteResponsePayload } {
  let rawCode = '';
  if (typeof err?.code === 'string') {
    rawCode = err.code;
  } else if (err?.name === 'AbortError') {
    rawCode = 'ABORTED';
  } else if (err?.name === 'TimeoutError') {
    rawCode = 'TIMEOUT';
  }
  const code = rawCode.trim().toUpperCase();

  const known = Object.prototype.hasOwnProperty.call(KNOWN_ERROR_ALLOWLIST, code)
    ? KNOWN_ERROR_ALLOWLIST[code]
    : undefined;

  if (known) {
    const errorBody = JSON.stringify(
      {
        error: known.statusText,
        code: known.errorCode,
        message: known.message,
      },
      null,
      2
    );

    return {
      httpStatus: known.statusCode,
      payload: {
        status: known.statusCode,
        statusText: known.statusText,
        headers: { 'content-type': 'application/json' },
        time: 0,
        size: Buffer.byteLength(errorBody, 'utf8'),
        body: errorBody,
        isError: true,
        errorMessage: known.message,
      },
    };
  }

  // Ensure fallback HTTP status and response envelope fields cannot disagree
  const statusNumber =
    typeof fallbackStatus === 'number' && Number.isInteger(fallbackStatus) && fallbackStatus >= 400 && fallbackStatus <= 599
      ? fallbackStatus
      : 500;

  const fallbackStatusText =
    statusNumber === 500 ? 'Internal Server Error' :
    statusNumber === 502 ? 'Bad Gateway' :
    statusNumber === 503 ? 'Service Unavailable' :
    statusNumber === 504 ? 'Gateway Timeout' :
    statusNumber === 400 ? 'Bad Request' :
    'Error';

  // Safe generic response for unclassified or internal exceptions
  const defaultMessage = 'An internal execution error occurred while processing the request.';
  const defaultBody = JSON.stringify(
    {
      error: fallbackStatusText,
      code: 'INTERNAL_ERROR',
      message: defaultMessage,
    },
    null,
    2
  );

  return {
    httpStatus: statusNumber,
    payload: {
      status: statusNumber,
      statusText: fallbackStatusText,
      headers: { 'content-type': 'application/json' },
      time: 0,
      size: Buffer.byteLength(defaultBody, 'utf8'),
      body: defaultBody,
      isError: true,
      errorMessage: defaultMessage,
    },
  };
}

/**
 * POST /api/request/execute (or /api/execute)
 * Dispatches an API request through the backend proxy with Supabase JWT authentication.
 */
executeRouter.post('/execute', requireAuth, async (req: Request, res: Response) => {
  const abortController = new AbortController();

  res.on('close', () => {
    if (!res.writableEnded) {
      abortController.abort();
    }
  });

  const payload: ExecuteRequestPayload = req.body;

  try {
    if (!payload || !payload.url || typeof payload.url !== 'string' || !payload.url.trim()) {
      res.status(400).json({
        status: 400,
        statusText: 'Bad Request',
        headers: { 'content-type': 'application/json' },
        time: 0,
        size: 0,
        body: JSON.stringify({ error: 'Request payload must include a valid "url" field.' }),
        isError: true,
        errorMessage: 'Missing required "url" field.',
      });
      return;
    }

    const result = await RequestExecutorService.execute(payload, abortController.signal);
    if (!res.headersSent) {
      res.status(200).json(result);
    }
  } catch (err: any) {
    if (!res.headersSent) {
      // Diagnostic server-side logging with minimal operational context without leaking secrets or full paths
      try {
        let hostContext = 'unknown';
        if (typeof payload?.url === 'string') {
          try {
            hostContext = new URL(payload.url).hostname || 'invalid-url';
          } catch {
            hostContext = 'invalid-url';
          }
        }
        const safeErrorCode =
          typeof err?.code === 'string'
            ? err.code
            : typeof err?.name === 'string'
            ? err.name
            : 'INTERNAL_ERROR';
        console.error(`[APIForge Execute Router] Execution failure: code=${safeErrorCode} host=${hostContext}`);
      } catch {
        console.error('[APIForge Execute Router] Execution failure occurred');
      }

      const sanitized = buildSanitizedErrorEnvelope(err, 500);
      res.status(sanitized.httpStatus).json(sanitized.payload);
    }
  }
});
