import { z } from 'zod';

const thresholdSchema = z.number().min(0).max(10);
const letterSchema = z
  .string()
  .trim()
  .min(1)
  .max(2)
  .regex(/^[A-Fa-f][+-]?$/, 'Letter grade must look like A, A+, B, C-, F');

export const createGradeScaleSchema = z.object({
  minScore10: thresholdSchema,
  letterGrade: letterSchema,
  grade4: z.number().min(0).max(4),
  isPass: z.boolean(),
});

export const updateGradeScaleSchema = createGradeScaleSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  });
