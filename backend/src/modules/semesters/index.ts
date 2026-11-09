import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, AppError } from '../../lib/errors';
import * as repository from './semesters.repository';

export const semestersRouter = Router();

const codeSchema = z
  .string()
  .trim()
  .min(1)
  .max(30)
  .regex(
    /^[\p{L}\p{N}._\- ]+$/u,
    'Mã học kỳ chỉ gồm chữ, số, khoảng trắng, dấu chấm, gạch ngang',
  );

const semesterInputSchema = z.object({
  code: codeSchema,
  name: z.string().trim().max(100).default(''),
  startDate: z.string().date().nullable().optional().default(null),
  endDate: z.string().date().nullable().optional().default(null),
  isActive: z.boolean().default(true),
  sortNo: z.number().int().min(0).max(10000).default(0),
});

const semesterUpdateSchema = z
  .object({
    name: z.string().trim().max(100).optional(),
    startDate: z.string().date().nullable().optional(),
    endDate: z.string().date().nullable().optional(),
    isActive: z.boolean().optional(),
    sortNo: z.number().int().min(0).max(10000).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  });

/** Shared semester list for every authenticated user (combo boxes). */
semestersRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const semesters = await repository.listSemesters(true);
    res.json({ semesters });
  }),
);

export const adminSemestersRouter = Router();

adminSemestersRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const semesters = await repository.listSemesters(false);
    res.json({ semesters });
  }),
);

adminSemestersRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const input = semesterInputSchema.parse(req.body);
    const result = await repository
      .createSemester(input)
      .catch((error: { code?: string }) => {
        if (error.code === '23505') throw AppError.conflict('Mã học kỳ đã tồn tại');
        throw error;
      });
    res.status(201).json({ semester: result });
  }),
);

adminSemestersRouter.patch(
  '/:code',
  asyncHandler(async (req, res) => {
    const input = semesterUpdateSchema.parse(req.body);
    const updated = await repository.updateSemester(req.params.code, input);
    if (!updated) throw AppError.notFound('Semester not found');
    res.json({ semester: updated });
  }),
);

adminSemestersRouter.delete(
  '/:code',
  asyncHandler(async (req, res) => {
    const removed = await repository.deleteSemester(req.params.code);
    if (!removed) throw AppError.notFound('Semester not found');
    res.status(204).send();
  }),
);
