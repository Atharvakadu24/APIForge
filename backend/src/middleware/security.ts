import { Request, Response, NextFunction } from 'express';

/**
 * Standard Security Headers Middleware
 * Protects against MIME-sniffing, clickjacking, and sets referrer policy.
 */
export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '0');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
}

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

/**
 * Creates an in-memory fixed-window rate limiter.
 * Enforces a maximum request budget within discrete fixed time windows per client IP.
 * Default: max 120 requests per 60-second window per client IP.
 */
export function createRateLimiter(options: { windowMs?: number; maxRequests?: number } = {}) {
  const rawWindow = options?.windowMs;
  const windowMs =
    typeof rawWindow === 'number' && Number.isFinite(rawWindow) && rawWindow > 0
      ? rawWindow
      : 60 * 1000;

  const rawMax = options?.maxRequests;
  const normalizedMax =
    typeof rawMax === 'number' && Number.isFinite(rawMax) ? Math.floor(rawMax) : 120;
  // Ensure maxRequests is a positive integer >= 1; fractional values below 1 must not produce a 0-request limit
  const maxRequests = normalizedMax >= 1 ? normalizedMax : 120;
  const clientMap = new Map<string, RateLimitRecord>();

  // Periodic cleanup of stale IP records every 5 minutes to prevent memory leaks
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of clientMap.entries()) {
      if (now > record.resetAt) {
        clientMap.delete(key);
      }
    }
  }, 5 * 60 * 1000);

  // Unref interval so it does not block Node process exit
  if (typeof cleanupInterval.unref === 'function') {
    cleanupInterval.unref();
  }

  return (req: Request, res: Response, next: NextFunction): void => {
    // In Express, req.ip respects the 'trust proxy' setting when configured behind a reverse proxy.
    // If trust proxy is unconfigured, it safely falls back to socket.remoteAddress to prevent spoofing.
    const ip = (req.ip || req.socket?.remoteAddress || 'unknown-client').trim();
    const now = Date.now();

    let record = clientMap.get(ip);
    if (!record || now > record.resetAt) {
      record = { count: 1, resetAt: now + windowMs };
      clientMap.set(ip, record);
    } else {
      record.count += 1;
    }

    const remaining = Math.max(0, maxRequests - record.count);
    const retryAfterSec = Math.ceil((record.resetAt - now) / 1000);

    res.setHeader('X-RateLimit-Limit', maxRequests.toString());
    res.setHeader('X-RateLimit-Remaining', remaining.toString());
    res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetAt / 1000).toString());

    if (record.count > maxRequests) {
      res.setHeader('Retry-After', retryAfterSec.toString());
      res.status(429).json({
        status: 429,
        statusText: 'Too Many Requests',
        headers: { 'content-type': 'application/json' },
        time: 0,
        size: 0,
        body: JSON.stringify({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded. Please wait before submitting additional requests.',
          retryAfterSeconds: retryAfterSec,
        }),
        isError: true,
        errorMessage: 'Rate limit exceeded. Please slow down.',
      });
      return;
    }

    next();
  };
}

/**
 * Global Express Error Handling Middleware
 * Prevents stack traces and sensitive error details from leaking to clients.
 * Safely delegates when response headers have already been transmitted.
 */
export function globalErrorHandler(
  err: any,
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  // If response headers have already been sent, delegate to default Express error handler
  if (res.headersSent) {
    return next(err);
  }

  // Catch malformed JSON syntax error from express.json() / body-parser
  if (err instanceof SyntaxError && 'body' in err && (err as any).status === 400) {
    res.status(400).json({
      status: 400,
      statusText: 'Bad Request',
      headers: { 'content-type': 'application/json' },
      time: 0,
      size: 0,
      body: JSON.stringify({
        error: 'Bad Request',
        message: 'Malformed JSON payload in request body.',
      }),
      isError: true,
      errorMessage: 'Malformed JSON payload.',
    });
    return;
  }

  // Catch oversized request payload (entity.too.large / status 413)
  if (
    (err as any).type === 'entity.too.large' ||
    (err as any).status === 413 ||
    (err as any).statusCode === 413
  ) {
    res.status(413).json({
      status: 413,
      statusText: 'Payload Too Large',
      headers: { 'content-type': 'application/json' },
      time: 0,
      size: 0,
      body: JSON.stringify({
        error: 'Payload Too Large',
        message: 'Request payload exceeds the maximum allowed size limit.',
      }),
      isError: true,
      errorMessage: 'Request payload exceeds size limit.',
    });
    return;
  }

  // Safe status code normalization (must be integer between 400 and 599)
  const rawStatus =
    typeof err?.status === 'number'
      ? err.status
      : typeof err?.statusCode === 'number'
        ? err.statusCode
        : 500;
  const statusCode = Number.isInteger(rawStatus) && rawStatus >= 400 && rawStatus <= 599 ? rawStatus : 500;

  // For 5xx or unclassified errors, never leak internal error message or stack trace
  const clientMessage =
    statusCode >= 500
      ? 'An internal server error occurred while processing your request.'
      : typeof err?.message === 'string' &&
          err.message.length > 0 &&
          !err.message.includes('\n') &&
          !err.message.includes(' at ')
        ? err.message
        : 'Request error.';

  res.status(statusCode).json({
    status: statusCode,
    statusText: statusCode === 500 ? 'Internal Server Error' : 'Error',
    headers: { 'content-type': 'application/json' },
    time: 0,
    size: 0,
    body: JSON.stringify({
      error: statusCode === 500 ? 'Internal Server Error' : 'Request Error',
      message: clientMessage,
    }),
    isError: true,
    errorMessage: clientMessage,
  });
}

/**
 * 404 Not Found Middleware for unhandled routes
 */
export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({
    status: 404,
    statusText: 'Not Found',
    headers: { 'content-type': 'application/json' },
    time: 0,
    size: 0,
    body: JSON.stringify({
      error: 'Not Found',
      message: 'The requested API route does not exist.',
    }),
    isError: true,
    errorMessage: 'Route not found.',
  });
}
