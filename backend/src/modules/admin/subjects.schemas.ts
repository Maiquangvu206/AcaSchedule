import { z } from 'zod';

const codeSchema = z
  .string()
  .trim()
  .min(2)
  .max(20)
  .regex(/^[A-Za-z0-9]+$/, 'Subject code must be alphanumeric')
  .transform((value) => value.toUpperCase());

const weightSchema = z.number().min(0).max(1);

export const createSubjectSchema = z
  .object({
    code: codeSchema,
    name: z.string().trim().min(2).max(255),
    credits: z.number().int().min(1).max(30),
    knowledgeBlock: z.string().trim().min(1).max(100).default('General'),
    processWeight: weightSchema.default(0.4),
    finalWeight: weightSchema.default(0.6),
  })
  .refine((value) => Math.abs(value.processWeight + value.finalWeight - 1) < 0.001, {
    message: 'processWeight + finalWeight must equal 1',
    path: ['finalWeight'],
  });

export const updateSubjectSchema = z
  .object({
    code: codeSchema.optional(),
    name: z.string().trim().min(2).max(255).optional(),
    credits: z.number().int().min(1).max(30).optional(),
    knowledgeBlock: z.string().trim().min(1).max(100).optional(),
    processWeight: weightSchema.optional(),
    finalWeight: weightSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  });
