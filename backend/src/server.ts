import express, { Request, Response } from 'express';
import cors from 'cors';
import { config, isSupabaseAuthConfigured } from './config';
import { executeRouter } from './routes/executeRouter';

const app = express();
const PORT = config.PORT;

// Enable CORS with configurable origins
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
      callback(new Error(`Origin ${origin} is not allowed by CORS`));
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

// Mount Request Execution Engine router
app.use('/api/request', executeRouter);
app.use('/api', executeRouter); // Allows both /api/request/execute and /api/execute

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
