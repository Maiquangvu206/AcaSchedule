import { Router } from 'express';
import { asyncHandler } from '../../lib/errors';
import { listDocumentsQuerySchema } from '../document/document.schemas';
import * as documentRepository from '../document/document.repository';

/**
 * Admin → tài liệu cộng đồng.
 *
 * Khác với `/api/documents` (chỉ trả tài liệu của các môn sinh viên đã đăng
 * ký), endpoint này trả về **toàn bộ** tài liệu để admin quản lý.
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
