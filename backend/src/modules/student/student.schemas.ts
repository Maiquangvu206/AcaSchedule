import { z } from 'zod';

const semesterSchema = z
  .string()
  .trim()
  .min(1)
  .max(30)
  .regex(/^[\p{L}\p{N}._\- ]+$/u, 'Semester may only contain letters, digits, space, dot and dash');

const scoreSchema = z.number().min(0).max(10);

export const createEnrollmentSchema = z.object({
  subjectId: z.string().uuid(),
  semester: semesterSchema,
  processScore: scoreSchema,
  finalScore: scoreSchema,
});

export const updateEnrollmentSchema = z
  .object({
    semester: semesterSchema.optional(),
    processScore: scoreSchema.optional(),
    finalScore: scoreSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  });

export const registerSectionsSchema = z.object({
  semester: semesterSchema,
  sectionIds: z.array(z.string().uuid()).min(1).max(30),
});

export const studyPlanPlacementSchema = z.object({
  subjectId: z.string().uuid(),
  // null = follow the admin-defined programme again
  semesterNo: z.number().int().min(1).max(20).nullable(),
});

export type StudyPlanPlacementInput = z.infer<typeof studyPlanPlacementSchema>;

export type CreateEnrollmentInput = z.infer<typeof createEnrollmentSchema>;
export type UpdateEnrollmentInput = z.infer<typeof updateEnrollmentSchema>;
