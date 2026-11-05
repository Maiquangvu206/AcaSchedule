import { Router } from 'express';

/**
 * AI Advisor — Gemini + RAG over lecture documents.
 *
 * Rules to implement (BR-AI):
 *  - Analyse component grades per knowledge block and suggest target exam scores.
 *  - Extract PDF/DOCX text from MinIO, chunk + embed, then answer exam questions.
 */
export const aiRouter = Router();

aiRouter.get('/', (_req, res) => {
  res.status(501).json({
    module: 'ai',
    status: 'not-implemented',
    planned: ['/api/ai/advice', '/api/ai/documents/:id/summarize', '/api/ai/qa'],
  });
});
