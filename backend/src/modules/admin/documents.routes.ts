import { Router } from 'express';
import { z } from 'zod';
import { AppError, asyncHandler } from '../../lib/errors';
import { listDocumentsQuerySchema } from '../document/document.schemas';
import * as documentRepository from '../document/document.repository';
import * as documentService from '../document/document.service';

/**
 * Admin → tài liệu cộng đồng.
 *
 * Khác với `/api/documents` (chỉ trả tài liệu của các môn sinh viên đã đăng
 * ký), endpoint này trả về **toàn bộ** tài liệu để admin quản lý (ẩn/khóa/xóa).
 */
export const adminDocumentsRouter = Router();

adminDocumentsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const query = listDocumentsQuerySchema.parse(req.query);
    const documents = await documentRepository.listAllDocuments(query);
    res.json({ documents });
  }),
);

const idSchema = z.object({ id: z.string().uuid() });
const flagsSchema = z
  .object({
    isHidden: z.boolean().optional(),
    isLocked: z.boolean().optional(),
  })
  .refine((value) => value.isHidden !== undefined || value.isLocked !== undefined, {
    message: 'Cần cung cấp isHidden hoặc isLocked',
  });

/** Ẩn/hiện hoặc khóa/mở khóa tài liệu. */
adminDocumentsRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = idSchema.parse(req.params);
    const flags = flagsSchema.parse(req.body);
    const document = await documentService.adminUpdateDocumentFlags(id, flags);
    res.json({ document });
  }),
);

/** Xóa hẳn tài liệu (metadata + file trên storage). */
adminDocumentsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = idSchema.parse(req.params);
    await documentService.adminDeleteDocument(id);
    res.status(204).send();
  }),
);
