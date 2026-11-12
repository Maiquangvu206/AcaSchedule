import { Router } from 'express';
import { asyncHandler, AppError } from '../../lib/errors';
import { authenticate, requireRole } from '../auth/auth.middleware';
import { tuitionFeeSchema } from './tuition_fees.schemas';
import * as tuitionFeesService from './tuition_fees.service';

export const tuitionFeesRouter = Router();

/** Danh sách học phí theo từng học kỳ. */
tuitionFeesRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const tuitionFees = await tuitionFeesService.listTuitionFees(
      _req.user?.role === 'student' ? _req.user.id : undefined,
    );
    res.json({ tuitionFees });
  }),
);

/** Tạo/cập nhật học phí cho một học kỳ (chỉ admin). */
tuitionFeesRouter.post(
  '/',
  authenticate,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const input = tuitionFeeSchema.parse(req.body);
    const tuitionFee = await tuitionFeesService.upsertTuitionFee(input);
    res.status(201).json(tuitionFee);
  }),
);

/** Lấy học phí của một học kỳ cụ thể. */
tuitionFeesRouter.get(
  '/:semester',
  asyncHandler(async (req, res) => {
    const tuitionFee = await tuitionFeesService.getTuitionFeeForSemester(
      req.params.semester,
      req.user?.role === 'student' ? req.user.id : undefined,
    );
    if (!tuitionFee) {
      throw new AppError(404, 'NotFound', 'Không tìm thấy học phí cho học kỳ này');
    }
    res.json(tuitionFee);
  }),
);
