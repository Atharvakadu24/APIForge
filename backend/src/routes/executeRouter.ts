import { Router, Request, Response } from 'express';
import { RequestExecutorService } from '../services/requestExecutor';
import type { ExecuteRequestPayload } from '../types/execution';

export const executeRouter = Router();

/**
 * POST /api/request/execute (or /api/execute)
 * Dispatches an API request through the backend proxy.
 */
executeRouter.post('/execute', async (req: Request, res: Response) => {
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

    const result = await RequestExecutorService.execute(payload);
    res.status(200).json(result);
  } catch (err: any) {
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
});
