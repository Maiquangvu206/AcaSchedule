import { Router } from 'express';
import { asyncHandler } from '../../lib/errors';
import { createEnrollmentSchema, registerSectionsSchema, studyPlanPlacementSchema, updateEnrollmentSchema } from './student.schemas';
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

studentRouter.post('/enrollments/register-sections', asyncHandler(async (req, res) => {
  const input = registerSectionsSchema.parse(req.body);
  const result = await studentService.registerSections(req.user!.id, input.semester, input.sectionIds);
  res.status(201).json(result);
}));

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

/** Study plan of the student's own major with personal placements applied. */
studentRouter.get(
  '/study-plan',
  asyncHandler(async (req, res) => {
    const plan = await studentService.getStudyPlan(req.user!.id);
    res.json(plan);
  }),
);

/** Move one subject to another semester in the student's personal plan. */
studentRouter.put(
  '/study-plan/placements',
  asyncHandler(async (req, res) => {
    const input = studyPlanPlacementSchema.parse(req.body);
    const plan = await studentService.updateStudyPlanPlacement(
      req.user!.id,
      input.subjectId,
      input.semesterNo,
    );
    res.json(plan);
  }),
);

/** Reset every personal placement back to the admin-defined programme. */
studentRouter.delete(
  '/study-plan/placements',
  asyncHandler(async (req, res) => {
    const plan = await studentService.resetStudyPlan(req.user!.id);
    res.json(plan);
  }),
);
