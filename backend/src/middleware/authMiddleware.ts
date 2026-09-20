import { Request, Response, NextFunction } from 'express';
import { config, isSupabaseAuthConfigured } from '../config';

export interface AuthenticatedUser {
  id: string;
  aud?: string;
  role?: string;
  email?: string;
  app_metadata?: Record<string, any>;
  user_metadata?: Record<string, any>;
  [key: string]: any;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

/**
 * Express middleware to authenticate requests using Supabase JWT tokens.
 * Validates the Authorization header format and verifies the token against the Supabase Auth service.
 */
export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization || (req.headers.Authorization as string | undefined);

  // 1. Check for Authorization header presence
  if (!authHeader) {
    res.status(401).json({
      status: 401,
      statusText: 'Unauthorized',
      headers: { 'content-type': 'application/json' },
      time: 0,
      size: 0,
      body: JSON.stringify({
        error: 'Unauthorized',
        message: 'Missing Authorization header. Expected Bearer <access_token>.',
      }),
      isError: true,
      errorMessage: 'Missing Authorization header.',
    });
    return;
  }

  // 2. Validate Bearer scheme
  if (!authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      status: 401,
      statusText: 'Unauthorized',
      headers: { 'content-type': 'application/json' },
      time: 0,
      size: 0,
      body: JSON.stringify({
        error: 'Unauthorized',
        message: 'Malformed Authorization header. Format must be "Bearer <access_token>".',
      }),
      isError: true,
      errorMessage: 'Malformed Authorization header format.',
    });
    return;
  }

  const token = authHeader.slice(7).trim();

  // 3. Check for non-empty token string
  if (!token) {
    res.status(401).json({
      status: 401,
      statusText: 'Unauthorized',
      headers: { 'content-type': 'application/json' },
      time: 0,
      size: 0,
      body: JSON.stringify({
        error: 'Unauthorized',
        message: 'Authentication token is empty.',
      }),
      isError: true,
      errorMessage: 'Authentication token is empty.',
    });
    return;
  }

  // 4. Validate JWT structure (3 base64url segments: header.payload.signature)
  const segments = token.split('.');
  if (segments.length !== 3) {
    res.status(401).json({
      status: 401,
      statusText: 'Unauthorized',
      headers: { 'content-type': 'application/json' },
      time: 0,
      size: 0,
      body: JSON.stringify({
        error: 'Unauthorized',
        message: 'Invalid JWT structure. Token must consist of 3 segments.',
      }),
      isError: true,
      errorMessage: 'Invalid JWT token format.',
    });
    return;
  }

  // 5. Check local payload expiration if present
  try {
    const payloadJson = Buffer.from(segments[1], 'base64url').toString('utf8');
    const payload = JSON.parse(payloadJson);
    if (payload.exp && typeof payload.exp === 'number') {
      const nowInSeconds = Math.floor(Date.now() / 1000);
      if (payload.exp < nowInSeconds) {
        res.status(401).json({
          status: 401,
          statusText: 'Unauthorized',
          headers: { 'content-type': 'application/json' },
          time: 0,
          size: 0,
          body: JSON.stringify({
            error: 'Unauthorized',
            message: 'Supabase authentication token has expired.',
          }),
          isError: true,
          errorMessage: 'Authentication token has expired.',
        });
        return;
      }
    }
  } catch {
    res.status(401).json({
      status: 401,
      statusText: 'Unauthorized',
      headers: { 'content-type': 'application/json' },
      time: 0,
      size: 0,
      body: JSON.stringify({
        error: 'Unauthorized',
        message: 'Malformed JWT payload encoding.',
      }),
      isError: true,
      errorMessage: 'Malformed JWT payload.',
    });
    return;
  }

  // 6. Verify configuration on backend
  if (!isSupabaseAuthConfigured()) {
    console.error(
      '[APIForge Backend Auth] Supabase URL or Anon/Publishable Key is not configured on the backend.'
    );
    res.status(500).json({
      status: 500,
      statusText: 'Internal Server Error',
      headers: { 'content-type': 'application/json' },
      time: 0,
      size: 0,
      body: JSON.stringify({
        error: 'Configuration Error',
        message:
          'Backend Supabase authentication is not configured. Please ensure SUPABASE_URL and SUPABASE_ANON_KEY are set.',
      }),
      isError: true,
      errorMessage: 'Backend Supabase authentication configuration missing.',
    });
    return;
  }

  // 7. Verify token against Supabase Auth API endpoint
  try {
    const supabaseUserUrl = `${config.SUPABASE_URL.replace(/\/+$/, '')}/auth/v1/user`;
    const authResponse = await fetch(supabaseUserUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: config.SUPABASE_ANON_KEY,
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!authResponse.ok) {
      let errorDetail = 'Invalid or expired Supabase token.';
      try {
        const errJson = (await authResponse.json()) as any;
        errorDetail = errJson?.msg || errJson?.message || errJson?.error_description || errorDetail;
      } catch {
        // Fall back to default error detail
      }

      res.status(401).json({
        status: 401,
        statusText: 'Unauthorized',
        headers: { 'content-type': 'application/json' },
        time: 0,
        size: 0,
        body: JSON.stringify({
          error: 'Unauthorized',
          message: errorDetail,
        }),
        isError: true,
        errorMessage: errorDetail,
      });
      return;
    }

    const userData = (await authResponse.json()) as AuthenticatedUser;
    if (!userData || !userData.id) {
      res.status(401).json({
        status: 401,
        statusText: 'Unauthorized',
        headers: { 'content-type': 'application/json' },
        time: 0,
        size: 0,
        body: JSON.stringify({
          error: 'Unauthorized',
          message: 'Unable to retrieve valid user identity from token.',
        }),
        isError: true,
        errorMessage: 'Invalid user identity in token.',
      });
      return;
    }

    // Attach validated user to request object and proceed
    req.user = userData;
    next();
  } catch (err: any) {
    const isTimeout = err.name === 'TimeoutError' || err.name === 'AbortError';
    const message = isTimeout
      ? 'Supabase authentication service timed out while verifying token.'
      : `Failed to verify token with Supabase auth: ${err.message}`;

    console.error('[APIForge Backend Auth] Verification error:', message);

    res.status(503).json({
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'content-type': 'application/json' },
      time: 0,
      size: 0,
      body: JSON.stringify({
        error: 'Authentication Service Unavailable',
        message,
      }),
      isError: true,
      errorMessage: message,
    });
  }
}
