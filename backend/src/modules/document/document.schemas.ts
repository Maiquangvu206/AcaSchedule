import { z } from 'zod';
import { MAX_DOCUMENT_SIZE_BYTES } from './document.engine';

const fileNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .refine((value) => !value.includes('/') && !value.includes('\\'), {
    message: 'File name must not contain path separators',
  });

export const presignUploadSchema = z.object({
  subjectId: z.string().uuid(),
  fileName: fileNameSchema,
  mimeType: z.string().trim().min(1).max(120),
  sizeBytes: z.number().int().positive().max(MAX_DOCUMENT_SIZE_BYTES),
});

export const createDocumentSchema = presignUploadSchema.extend({
  objectKey: z.string().trim().min(1).max(500),
  title: z.string().trim().min(1).max(255),
});

export const listDocumentsQuerySchema = z.object({
  subjectId: z.string().uuid().optional(),
  q: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((value) => value || undefined),
  sort: z.enum(['rank', 'newest']).optional().default('rank'),
});

export const voteDocumentSchema = z.object({
  value: z.union([z.literal(-1), z.literal(0), z.literal(1)]),
});

export const downloadQuerySchema = z.object({
  inline: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
});

export type PresignUploadInput = z.infer<typeof presignUploadSchema>;
export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;
export type ListDocumentsQuery = z.infer<typeof listDocumentsQuerySchema>;
export type VoteDocumentInput = z.infer<typeof voteDocumentSchema>;
