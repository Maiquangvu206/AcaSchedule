import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, AppError } from '../../lib/errors';
import { pool } from '../../database/pool';
import * as repository from './schedule.repository';
import type { RegistrationConfig } from '../schedule/schedule.types';

const sectionSchema = z.object({
  subjectId: z.string().uuid(),
  semester: z.string().trim().min(1).max(20),
  sectionCode: z.string().trim().min(1).max(30),
  dayOfWeek: z.number().int().min(2).max(7),
  startPeriod: z.number().int().min(1).max(12),
  endPeriod: z.number().int().min(1).max(12),
  classType: z.enum(['lecture', 'practical']).default('lecture'),
  meetingCount: z.number().int().min(1).max(2).default(1),
  linkedSectionId: z.string().uuid().nullable().optional(),
  startDate: z.string().date().nullable().optional(),
  endDate: z.string().date().nullable().optional(),
  secondDayOfWeek: z.number().int().min(2).max(7).nullable().optional(),
  secondStartPeriod: z.number().int().min(1).max(12).nullable().optional(),
  secondEndPeriod: z.number().int().min(1).max(12).nullable().optional(),
  room: z.string().trim().max(50).nullable().optional(),
  lecturer: z.string().trim().max(120).nullable().optional(),
  capacity: z.number().int().positive().nullable().optional(),
  isCancelled: z.boolean().optional().default(false),
}).refine((value) => value.endPeriod >= value.startPeriod, {
  message: 'Tiết kết thúc phải lớn hơn hoặc bằng tiết bắt đầu',
  path: ['endPeriod'],
}).refine((value) => value.meetingCount === 1 || (
  value.secondDayOfWeek !== null &&
  value.secondStartPeriod !== null &&
  value.secondEndPeriod !== null
), { message: 'Lớp 2 buổi phải có lịch buổi thứ hai', path: ['secondDayOfWeek'] })
  .refine((value) => value.meetingCount === 1 || (
    (value.dayOfWeek === 2 && value.secondDayOfWeek === 5) ||
    (value.dayOfWeek === 3 && value.secondDayOfWeek === 6) ||
    (value.dayOfWeek === 4 && value.secondDayOfWeek === 7)
  ), { message: 'Lịch 2 buổi chỉ hỗ trợ cặp 2-5, 3-6 hoặc 4-7', path: ['secondDayOfWeek'] })
  .refine((value) => value.meetingCount === 1 || value.secondEndPeriod! >= value.secondStartPeriod!, {
    message: 'Tiết kết thúc buổi hai không hợp lệ', path: ['secondEndPeriod'],
  });

const selectSection = `
  SELECT cs.id, cs.subject_id AS "subjectId", s.code AS "subjectCode",
         s.name AS "subjectName", s.credits, cs.semester,
         cs.section_code AS "sectionCode", cs.day_of_week AS "dayOfWeek",
         cs.start_period AS "startPeriod", cs.end_period AS "endPeriod",
         cs.class_type AS "classType", cs.start_date AS "startDate", cs.end_date AS "endDate",
         cs.meeting_count AS "meetingCount", cs.linked_section_id AS "linkedSectionId",
         cs.second_day_of_week AS "secondDayOfWeek",
         cs.second_start_period AS "secondStartPeriod", cs.second_end_period AS "secondEndPeriod",
         cs.room, cs.lecturer, cs.capacity, cs.is_cancelled AS "isCancelled"
  FROM course_sections cs
  JOIN subjects s ON s.id = cs.subject_id
`;

export const adminScheduleRouter = Router();

adminScheduleRouter.get('/sections', asyncHandler(async (req, res) => {
  const semester = typeof req.query.semester === 'string' ? req.query.semester : undefined;
  const result = await pool.query(
    `${selectSection} ${semester ? 'WHERE cs.semester = $1' : ''}
     ORDER BY cs.semester, cs.day_of_week, cs.start_period, s.code`,
    semester ? [semester] : [],
  );
  res.json({ sections: result.rows });
}));

adminScheduleRouter.get('/periods', asyncHandler(async (_req, res) => {
  const result = await pool.query(
    `SELECT period, to_char(start_time, 'HH24:MI') AS "startTime",
            to_char(end_time, 'HH24:MI') AS "endTime", label
       FROM period_slots
      ORDER BY period`,
  );
  res.json({ periods: result.rows });
}));

adminScheduleRouter.get('/registration-config', asyncHandler(async (req, res) => {
  const semester = typeof req.query.semester === 'string' ? req.query.semester : undefined;
  const result = await pool.query(
    `SELECT id, semester, is_open, opened_at, closed_at FROM registration_configs ${semester ? 'WHERE semester = $1' : ''} ORDER BY semester`,
    semester ? [semester] : [],
  );
  res.json({ configs: result.rows });
}));

adminScheduleRouter.patch('/registration-config', asyncHandler(async (req, res) => {
  const input = z.object({
    semester: z.string().trim().min(1).max(20),
    isOpen: z.boolean(),
    openedAt: z.string().nullable().optional(),
    closedAt: z.string().nullable().optional(),
  }).parse(req.body);
  
  const result = await pool.query(
    `INSERT INTO registration_configs (semester, is_open, opened_at, closed_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (semester) DO UPDATE
     SET is_open = EXCLUDED.is_open, opened_at = EXCLUDED.opened_at, closed_at = EXCLUDED.closed_at
     RETURNING id, semester, is_open, opened_at, closed_at`,
    [input.semester, input.isOpen, input.openedAt, input.closedAt],
  );
  res.json({ config: result.rows[0] });
}));

adminScheduleRouter.patch('/periods/:period', asyncHandler(async (req, res) => {
  const period = z.coerce.number().int().min(1).max(16).parse(req.params.period);
  const input = z.object({
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
    label: z.string().trim().min(1).max(30),
  }).refine((value) => value.endTime > value.startTime, {
    message: 'Giờ kết thúc phải sau giờ bắt đầu',
    path: ['endTime'],
  }).parse(req.body);
  const result = await pool.query(
    `UPDATE period_slots
        SET start_time = $1, end_time = $2, label = $3
      WHERE period = $4
      RETURNING period, to_char(start_time, 'HH24:MI') AS "startTime",
                to_char(end_time, 'HH24:MI') AS "endTime", label`,
    [input.startTime, input.endTime, input.label, period],
  );
  if (!result.rowCount) throw AppError.notFound('Không tìm thấy tiết học');
  res.json({ period: result.rows[0] });
}));

adminScheduleRouter.post('/sections', asyncHandler(async (req, res) => {
  const input = sectionSchema.parse(req.body);
  try {
    const result = await pool.query(
      `INSERT INTO course_sections
        (subject_id, semester, section_code, day_of_week, start_period, end_period, class_type,
         start_date, end_date, second_day_of_week, second_start_period, second_end_period,
         room, lecturer, capacity, is_cancelled, meeting_count, linked_section_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       RETURNING id`,
      [
        input.subjectId, input.semester, input.sectionCode, input.dayOfWeek,
        input.startPeriod, input.endPeriod, input.classType, input.startDate ?? null, input.endDate ?? null,
        input.secondDayOfWeek ?? null, input.secondStartPeriod ?? null, input.secondEndPeriod ?? null,
        input.room ?? null, input.lecturer ?? null, input.capacity ?? null, input.isCancelled,
        input.meetingCount, input.linkedSectionId ?? null,
      ],
    );
    const section = await pool.query(`${selectSection} WHERE cs.id = $1`, [result.rows[0].id]);
    res.status(201).json({ section: section.rows[0] });
  } catch (error) {
    if ((error as { code?: string }).code === '23505') {
      throw AppError.conflict('Mã lớp học phần đã tồn tại trong học kỳ này');
    }
    throw error;
  }
}));

adminScheduleRouter.patch('/sections/:id', asyncHandler(async (req, res) => {
  const input = sectionSchema.parse(req.body);
  const result = await pool.query(
    `UPDATE course_sections
        SET subject_id=$2, semester=$3, section_code=$4, day_of_week=$5,
            start_period=$6, end_period=$7, class_type=$8, start_date=$9, end_date=$10,
            second_day_of_week=$11, second_start_period=$12, second_end_period=$13,
            room=$14, lecturer=$15, capacity=$16, is_cancelled=$17,
            meeting_count=$18, linked_section_id=$19
      WHERE id=$1 RETURNING id`,
    [
      req.params.id, input.subjectId, input.semester, input.sectionCode, input.dayOfWeek,
      input.startPeriod, input.endPeriod, input.classType, input.startDate ?? null, input.endDate ?? null,
      input.secondDayOfWeek ?? null, input.secondStartPeriod ?? null, input.secondEndPeriod ?? null,
      input.room ?? null, input.lecturer ?? null, input.capacity ?? null, input.isCancelled,
      input.meetingCount, input.linkedSectionId ?? null,
    ],
  );
  if (!result.rows[0]) throw AppError.notFound('Không tìm thấy lớp học phần');
  const section = await pool.query(`${selectSection} WHERE cs.id = $1`, [req.params.id]);
  res.json({ section: section.rows[0] });
}));

adminScheduleRouter.delete('/sections/:id', asyncHandler(async (req, res) => {
  const result = await pool.query('DELETE FROM course_sections WHERE id = $1', [req.params.id]);
  if (!result.rowCount) throw AppError.notFound('Không tìm thấy lớp học phần');
  res.status(204).send();
}));
