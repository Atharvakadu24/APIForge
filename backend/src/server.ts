import express, { Request, Response } from 'express';
import cors from 'cors';
import { config, isSupabaseAuthConfigured } from './config';
import { executeRouter } from './routes/executeRouter';
import {
  securityHeaders,
  createRateLimiter,
  globalErrorHandler,
  notFoundHandler,
} from './middleware/security';

const app = express();
const PORT = config.PORT;

// Configure reverse proxy trust for accurate client IP resolution in rate limiting.
// In Render's single-hop architecture, trusting the first upstream proxy (1) allows Express to extract
// the client IP from the right-most address appended by Render's proxy, preventing spoofed X-Forwarded-For headers.
// Configurable via TRUST_PROXY env var (e.g. 1, false, or specific CIDRs).
if (config.TRUST_PROXY !== false) {
  app.set('trust proxy', config.TRUST_PROXY);
}

// Standard security headers
app.use(securityHeaders);

// Enable CORS with configurable origins (clean rejection without unhandled error)
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (such as mobile apps, curl, or server-to-server)
      if (!origin) {
        return callback(null, true);
      }
      if (
        config.ALLOWED_ORIGINS.includes(origin) ||
        config.ALLOWED_ORIGINS.includes('*')
      ) {
        return callback(null, true);
      }
      // Clean rejection: pass false instead of throwing unhandled Error
      callback(null, false);
    },
    credentials: true,
  })
);

// Body parsing middleware with 10MB limit for JSON & text
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health Check Endpoint (Public / Unauthenticated)
app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    service: 'apiforge-backend',
    authConfigured: isSupabaseAuthConfigured(),
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Rate limiting on request execution endpoints (120 requests/minute per client IP)
const executeRateLimiter = createRateLimiter({ windowMs: 60 * 1000, maxRequests: 120 });

// Mount Request Execution Engine router
app.use('/api/request', executeRateLimiter, executeRouter);
app.use('/api', executeRateLimiter, executeRouter); // Allows both /api/request/execute and /api/execute

// 404 Handler for unmatched routes
app.use(notFoundHandler);

// Global Error Handler (prevents stack trace leaks and handles malformed JSON)
app.use(globalErrorHandler);

// Start the server
app.listen(PORT, () => {
  console.log(`[APIForge Backend] Server is running locally on http://localhost:${PORT}`);
  console.log(`[APIForge Backend] Allowed CORS Origins: ${config.ALLOWED_ORIGINS.join(', ')}`);
  console.log(
    `[APIForge Backend] Supabase Auth Middleware: ${
      isSupabaseAuthConfigured() ? 'CONFIGURED & ACTIVE' : 'UNCONFIGURED'
    }`
  );
  console.log(`[APIForge Backend] Health check endpoint: http://localhost:${PORT}/api/health`);
  console.log(`[APIForge Backend] Request execution proxy: http://localhost:${PORT}/api/request/execute`);
});
