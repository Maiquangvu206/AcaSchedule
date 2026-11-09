import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, AppError } from '../../lib/errors';
import * as studentService from '../student/student.service';
import { findStudentProfile } from '../student/student.repository';

export const adminEnrollmentsRouter = Router();

const semesterSchema = z
  .string()
  .trim()
  .min(1)
  .max(30)
  .regex(/^[\p{L}\p{N}._\- ]+$/u, 'Mã học kỳ chỉ gồm chữ, số, khoảng trắng, dấu chấm và gạch ngang');

const scoreSchema = z.number().min(0).max(10);

const createSchema = z.object({
  studentId: z.string().uuid(),
  subjectId: z.string().uuid(),
  semester: semesterSchema,
  processScore: scoreSchema.optional(),
  finalScore: scoreSchema.optional(),
});

const updateSchema = z.object({
  processScore: scoreSchema,
  finalScore: scoreSchema,
});

async function ensureStudent(studentId: string) {
  const profile = await findStudentProfile(studentId);
  if (!profile) throw AppError.notFound('Student not found');
}

/** List all enrolment attempts of one student (optionally one semester). */
adminEnrollmentsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const studentId = typeof req.query.studentId === 'string' ? req.query.studentId : '';
    if (!studentId) throw AppError.badRequest('studentId is required');
    await ensureStudent(studentId);

    const enrollments = await studentService.listEnrollments(studentId);
    const semester = typeof req.query.semester === 'string' ? req.query.semester.trim() : '';
    res.json({
      enrollments: semester
        ? enrollments.filter((item) => item.semester === semester)
        : enrollments,
    });
  }),
);

/** Add a subject to a semester for a student (pending, or graded when scores are given). */
adminEnrollmentsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const input = createSchema.parse(req.body);
    await ensureStudent(input.studentId);
    const result = await studentService.createEnrollmentAdmin(input.studentId, input);
    res.status(201).json(result);
  }),
);

/** Update scores of an existing enrolment attempt. */
adminEnrollmentsRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const studentId = typeof req.query.studentId === 'string' ? req.query.studentId : '';
    if (!studentId) throw AppError.badRequest('studentId is required (query parameter)');
    await ensureStudent(studentId);
    const input = updateSchema.parse(req.body);
    const result = await studentService.updateEnrollmentById(studentId, req.params.id, input);
    res.json(result);
  }),
);

/** Remove an enrolment attempt. */
adminEnrollmentsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const studentId = typeof req.query.studentId === 'string' ? req.query.studentId : '';
    if (!studentId) throw AppError.badRequest('studentId is required (query parameter)');
    await ensureStudent(studentId);
    await studentService.deleteEnrollmentById(studentId, req.params.id);
    res.status(204).send();
  }),
);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
