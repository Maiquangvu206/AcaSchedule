import { Router } from 'express';
import { asyncHandler } from '../../lib/errors';
import {
  createDocumentSchema,
  downloadQuerySchema,
  listDocumentsQuerySchema,
  presignUploadSchema,
  voteDocumentSchema,
} from './document.schemas';
import * as documentService from './document.service';
import { documentRateLimit } from '../../lib/rate-limit';

export const documentRouter = Router();

/** Subjects the current student can contribute to / read documents for. */
documentRouter.get(
  '/subjects',
  asyncHandler(async (req, res) => {
    const subjects = await documentService.listSubjects(req.user!.id);
    res.json({ subjects });
  }),
);

/** Get a short-lived URL for a direct browser → MinIO upload. */
documentRouter.post(
  '/uploads/presign',
  documentRateLimit,
  asyncHandler(async (req, res) => {
    const input = presignUploadSchema.parse(req.body);
    const ticket = await documentService.presignUpload(req.user!.id, input);
    res.status(201).json(ticket);
  }),
);

/** Confirm the upload and save metadata. */
documentRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const input = createDocumentSchema.parse(req.body);
    const document = await documentService.createDocument(req.user!.id, input);
    res.status(201).json({ document });
  }),
);

documentRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const query = listDocumentsQuerySchema.parse(req.query);
    const documents = await documentService.listDocuments(req.user!.id, query);
    res.json({ documents });
  }),
);

/** Upvote / downvote / remove vote (value 0). One vote per user per document. */
documentRouter.post(
  '/:id/vote',
  asyncHandler(async (req, res) => {
    const input = voteDocumentSchema.parse(req.body);
    const document = await documentService.voteDocument(req.user!.id, req.params.id, input.value);
    res.json({ document });
  }),
);

/** Presigned download URL; pass `?inline=true` for the PDF viewer. */
documentRouter.get(
  '/:id/download',
  asyncHandler(async (req, res) => {
    const query = downloadQuerySchema.parse(req.query);
    const download = await documentService.getDownload(req.user!.id, req.params.id, query.inline);
    res.json(download);
  }),
);
