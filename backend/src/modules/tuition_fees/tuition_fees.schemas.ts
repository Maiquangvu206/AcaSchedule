import { z } from 'zod';

export const tuitionFeeSchema = z.object({
  semester: z.string().trim().min(1).max(20),
  majorId: z.string().uuid().nullable().optional(),
  feePerCredit: z.number().int().nonnegative(),
  currency: z.string().trim().min(1).max(10).optional().default('VND'),
});

export type TuitionFeeInput = z.infer<typeof tuitionFeeSchema>;
