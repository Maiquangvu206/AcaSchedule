import { Router } from 'express';

/**
 * Document Hub — crowdsourced study material per subject.
 *
 * Rules to implement (BR-DOCS):
 *  - A student may upload only for subjects present in their enrollments.
 *  - Upvote/downvote ranking drives search ordering.
 *  - Files are stored in MinIO; only metadata lives in PostgreSQL.
 */
export const documentRouter = Router();

documentRouter.get('/', (_req, res) => {
  res.status(501).json({
    module: 'documents',
    status: 'not-implemented',
    planned: ['/api/documents', '/api/documents/:id/vote', '/api/documents/:id/download'],
  });
});
