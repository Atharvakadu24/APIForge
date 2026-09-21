import { Router, Request, Response } from 'express';
import { RequestExecutorService } from '../services/requestExecutor';
import { requireAuth } from '../middleware/authMiddleware';
import type { ExecuteRequestPayload } from '../types/execution';

export const executeRouter = Router();

/**
 * POST /api/request/execute (or /api/execute)
 * Dispatches an API request through the backend proxy with Supabase JWT authentication.
 */
executeRouter.post('/execute', requireAuth, async (req: Request, res: Response) => {
  const abortController = new AbortController();

  req.on('close', () => {
    if (!res.writableEnded) {
      abortController.abort();
    }
  });

  try {
    const payload: ExecuteRequestPayload = req.body;

    if (!payload || !payload.url) {
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
      res.status(500).json({
        status: 500,
        statusText: 'Internal Server Error',
        headers: { 'content-type': 'application/json' },
        time: 0,
        size: 0,
        body: JSON.stringify({ error: 'Internal execution error', message: err.message }),
        isError: true,
        errorMessage: err.message,
      });
    }
  }
});
