import { Router } from 'express';
import { asyncHandler } from '../../lib/errors';
import { createEnrollmentSchema, updateEnrollmentSchema } from './student.schemas';
import * as studentService from './student.service';

export const studentRouter = Router();

studentRouter.get(
  '/enrollments',
  asyncHandler(async (req, res) => {
    const enrollments = await studentService.listEnrollments(req.user!.id);
    res.json({ enrollments });
  }),
);

studentRouter.post(
  '/enrollments',
  asyncHandler(async (req, res) => {
    const input = createEnrollmentSchema.parse(req.body);
    const result = await studentService.createEnrollment(req.user!.id, input);
    res.status(201).json(result);
  }),
);

studentRouter.patch(
  '/enrollments/:id',
  asyncHandler(async (req, res) => {
    const input = updateEnrollmentSchema.parse(req.body);
    const result = await studentService.updateEnrollmentById(req.user!.id, req.params.id, input);
    res.json(result);
  }),
);

studentRouter.delete(
  '/enrollments/:id',
  asyncHandler(async (req, res) => {
    await studentService.deleteEnrollmentById(req.user!.id, req.params.id);
    res.status(204).send();
  }),
);

studentRouter.get(
  '/transcript',
  asyncHandler(async (req, res) => {
    const transcript = await studentService.getTranscript(req.user!.id);
    res.json(transcript);
  }),
);
