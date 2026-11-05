import { Router } from 'express';
import { asyncHandler } from '../../lib/errors';
import { createGradeScaleSchema, updateGradeScaleSchema } from './grade-scales.schemas';
import * as gradeScaleService from './grade-scales.service';

export const gradeScalesRouter = Router();

gradeScalesRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const gradeScales = await gradeScaleService.listGradeScales();
    res.json({ gradeScales });
  }),
);

gradeScalesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const input = createGradeScaleSchema.parse(req.body);
    const gradeScale = await gradeScaleService.createGradeScale(input);
    res.status(201).json({ gradeScale });
  }),
);

gradeScalesRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const input = updateGradeScaleSchema.parse(req.body);
    const gradeScale = await gradeScaleService.updateGradeScale(req.params.id, input);
    res.json({ gradeScale });
  }),
);

gradeScalesRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await gradeScaleService.deleteGradeScale(req.params.id);
    res.status(204).send();
  }),
);
