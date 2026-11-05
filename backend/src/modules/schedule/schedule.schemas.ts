import { z } from 'zod';

const semesterSchema = z
  .string()
  .trim()
  .min(1)
  .max(20)
  .regex(/^[A-Za-z0-9._ -]+$/, 'Semester may only contain letters, digits, space, dot, dash and underscore');

const daySchema = z.number().int().min(2).max(8);
const periodSchema = z.number().int().min(1).max(12);
const timeSchema = z.string().regex(/^\d{2}:\d{2}$/, 'Time must use HH:MM format');
const weekStartSchema = z.string().date();

export const listSectionsQuerySchema = z.object({
  semester: semesterSchema.optional(),
  subjectId: z.string().uuid().optional(),
  includeCancelled: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
});

export const simulateSchema = z.object({
  semester: semesterSchema,
  sectionIds: z.array(z.string().uuid()).min(1).max(30),
  includeSavedItems: z.boolean().optional().default(true),
  weekStart: weekStartSchema.optional(),
});

export const createScheduleItemSchema = z
  .object({
    title: z.string().trim().min(1).max(255),
    semester: semesterSchema.nullable().optional().default(null),
    weekStart: weekStartSchema,
    sectionId: z.string().uuid().nullable().optional().default(null),
    dayOfWeek: daySchema,
    startPeriod: periodSchema.optional().default(1),
    endPeriod: periodSchema.optional().default(1),
    startTime: timeSchema,
    endTime: timeSchema,
    room: z.string().trim().max(50).nullable().optional().default(null),
    note: z.string().trim().max(1000).nullable().optional().default(null),
  })
  .refine((value) => value.endTime > value.startTime, {
    message: 'Thời gian kết thúc phải sau thời gian bắt đầu',
    path: ['endTime'],
  });

export const updateScheduleItemSchema = z
  .object({
    title: z.string().trim().min(1).max(255).optional(),
    semester: semesterSchema.nullable().optional(),
    weekStart: weekStartSchema.optional(),
    sectionId: z.string().uuid().nullable().optional(),
    dayOfWeek: daySchema.optional(),
    startPeriod: periodSchema.optional(),
    endPeriod: periodSchema.optional(),
    startTime: timeSchema.optional(),
    endTime: timeSchema.optional(),
    room: z.string().trim().max(50).nullable().optional(),
    note: z.string().trim().max(1000).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  })
  .refine((value) => !value.startTime || !value.endTime || value.endTime > value.startTime, {
    message: 'Thời gian kết thúc phải sau thời gian bắt đầu',
    path: ['endTime'],
  });

export type CreateScheduleItemInput = z.infer<typeof createScheduleItemSchema>;
export type UpdateScheduleItemInput = z.infer<typeof updateScheduleItemSchema>;
