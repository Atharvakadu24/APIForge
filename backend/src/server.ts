import express, { Request, Response } from 'express';
import cors from 'cors';
import { executeRouter } from './routes/executeRouter';

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS for frontend communication
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true
}));

// Body parsing middleware with 10MB limit for JSON & text
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health Check Endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    service: 'apiforge-backend',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Mount Request Execution Engine router
app.use('/api/request', executeRouter);
app.use('/api', executeRouter); // Allows both /api/request/execute and /api/execute

// Start the server
app.listen(PORT, () => {
  console.log(`[APIForge Backend] Server is running locally on http://localhost:${PORT}`);
  console.log(`[APIForge Backend] Health check endpoint: http://localhost:${PORT}/api/health`);
  console.log(`[APIForge Backend] Request execution proxy: http://localhost:${PORT}/api/request/execute`);
});
