import { Router, Request, Response } from 'express';
import { env } from '../../config/env';

/**
 * AI Advisor — proxy to the dedicated Python AI service (`ai/`).
 *
 * The service handles Gemini calls and local RAG fallbacks; this router keeps the
 * public contract stable at `/api/ai/*` and avoids exposing the AI service directly.
 */
export const aiRouter = Router();

const upstreamBase = () => env.AI_SERVICE_URL.replace(/\/+$/, '');

function forward(path: string) {
  return async (req: Request, res: Response) => {
    try {
      const upstream = await fetch(`${upstreamBase()}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(req.body ?? {}),
      });

      const body = await upstream.text();
      res.status(upstream.status).type('application/json').send(body);
    } catch (error) {
      console.error(`AI service request failed (${path})`, error);
      res.status(502).json({
        error: 'AIUnavailable',
        message: 'AI service is not reachable. Check the ai container or AI_SERVICE_URL.',
      });
    }
  };
}

aiRouter.get('/status', async (_req, res) => {
  try {
    const upstream = await fetch(`${upstreamBase()}/health`, {
      headers: { Accept: 'application/json' },
    });
    const body = await upstream.text();
    res.status(upstream.status).type('application/json').send(body);
  } catch {
    res.status(502).json({ error: 'AIUnavailable', status: 'down' });
  }
});

aiRouter.post('/advice', forward('/advice'));
aiRouter.post('/documents/summarize', forward('/documents/summarize'));
aiRouter.post('/qa', forward('/qa'));
