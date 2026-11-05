import { z } from 'zod';

export const calculateSchema = z.object({
  semester: z.string().min(1).max(20).optional(),
});

export const forecastSchema = z.object({
  targetCpa: z.number().min(0).max(4),
  additionalCredits: z.number().int().min(1).max(60).default(15),
  plannedGrade4: z.number().min(0).max(4).optional(),
});
