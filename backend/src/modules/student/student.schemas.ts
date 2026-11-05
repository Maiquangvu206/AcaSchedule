import { z } from 'zod';

const semesterSchema = z
  .string()
  .min(1)
  .max(20)
  .regex(/^[A-Za-z0-9._-]+$/, 'Semester may only contain letters, digits, dot, dash and underscore');

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

export type CreateEnrollmentInput = z.infer<typeof createEnrollmentSchema>;
export type UpdateEnrollmentInput = z.infer<typeof updateEnrollmentSchema>;
