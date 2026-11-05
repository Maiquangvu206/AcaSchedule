import { Router } from 'express';
import { asyncHandler } from '../../lib/errors';
import { createSubjectSchema, updateSubjectSchema } from './subjects.schemas';
import * as subjectService from './subjects.service';

export const subjectsRouter = Router();

subjectsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const subjects = await subjectService.listSubjects();
    res.json({ subjects });
  }),
);

subjectsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const input = createSubjectSchema.parse(req.body);
    const subject = await subjectService.createSubject(input);
    res.status(201).json({ subject });
  }),
);

subjectsRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const input = updateSubjectSchema.parse(req.body);
    const subject = await subjectService.updateSubject(req.params.id, input);
    res.json({ subject });
  }),
);

subjectsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await subjectService.deactivateSubject(req.params.id);
    res.status(204).send();
  }),
);
