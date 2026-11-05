import type { Pool, PoolClient } from 'pg';
import { pool } from '../../database/pool';
import type { CourseSection, PeriodSlot, ScheduleItem } from './schedule.types';

export type Queryable = Pool | PoolClient;

interface PeriodSlotRow {
  period: number;
  start_time: string;
  end_time: string;
  label: string;
}

interface CourseSectionRow {
  id: string;
  subject_id: string;
  subject_code: string;
  subject_name: string;
  credits: number;
  semester: string;
  section_code: string;
  day_of_week: number;
  start_period: number;
  end_period: number;
  class_type: 'lecture' | 'practical';
  meeting_count: number;
  linked_section_id: string | null;
  start_date: string | null;
  end_date: string | null;
  second_day_of_week: number | null;
  second_start_period: number | null;
  second_end_period: number | null;
  room: string | null;
  lecturer: string | null;
  capacity: number | null;
  is_cancelled: boolean;
}

interface ScheduleItemRow {
  id: string;
  section_id: string | null;
  title: string;
  semester: string | null;
  week_start: string;
  day_of_week: number;
  start_period: number;
  end_period: number;
  start_time: string;
  end_time: string;
  room: string | null;
  note: string | null;
  created_at: Date;
}

function shortTime(value: string): string {
  return value.slice(0, 5);
}

function mapPeriod(row: PeriodSlotRow): PeriodSlot {
  return {
    period: row.period,
    startTime: shortTime(row.start_time),
    endTime: shortTime(row.end_time),
    label: row.label,
  };
}

function mapSection(row: CourseSectionRow): CourseSection {
  return {
    id: row.id,
    subjectId: row.subject_id,
    subjectCode: row.subject_code,
    subjectName: row.subject_name,
    credits: row.credits,
    semester: row.semester,
    sectionCode: row.section_code,
    dayOfWeek: row.day_of_week,
    startPeriod: row.start_period,
    endPeriod: row.end_period,
    classType: row.class_type,
    meetingCount: row.meeting_count,
    linkedSectionId: row.linked_section_id,
    startDate: row.start_date,
    endDate: row.end_date,
    secondDayOfWeek: row.second_day_of_week,
    secondStartPeriod: row.second_start_period,
    secondEndPeriod: row.second_end_period,
    room: row.room,
    lecturer: row.lecturer,
    capacity: row.capacity,
    isCancelled: row.is_cancelled,
  };
}

function mapItem(row: ScheduleItemRow): ScheduleItem {
  return {
    id: row.id,
    sectionId: row.section_id,
    title: row.title,
    semester: row.semester,
    weekStart: row.week_start,
    dayOfWeek: row.day_of_week,
    startPeriod: row.start_period,
    endPeriod: row.end_period,
    startTime: row.start_time.slice(0, 5),
    endTime: row.end_time.slice(0, 5),
    room: row.room,
    note: row.note,
    createdAt: row.created_at.toISOString(),
  };
}

export async function listPeriodSlots(db: Queryable = pool): Promise<PeriodSlot[]> {
  const result = await db.query<PeriodSlotRow>(
    'SELECT period, start_time, end_time, label FROM period_slots ORDER BY period',
  );
  return result.rows.map(mapPeriod);
}

export async function listSemesters(db: Queryable = pool): Promise<string[]> {
  const result = await db.query<{ semester: string }>(
    `SELECT semester FROM course_sections
     UNION
     SELECT semester FROM tuition_fees
     ORDER BY semester DESC`,
  );
  return result.rows.map((row) => row.semester);
}

const SECTION_SELECT = `
  SELECT cs.id,
         cs.subject_id,
         s.code AS subject_code,
         s.name AS subject_name,
         s.credits,
         cs.semester,
         cs.section_code,
         cs.day_of_week,
         cs.start_period,
         cs.end_period,
         cs.class_type,
         cs.meeting_count,
         cs.linked_section_id,
         cs.start_date,
         cs.end_date,
         cs.second_day_of_week,
         cs.second_start_period,
         cs.second_end_period,
         cs.room,
         cs.lecturer,
         cs.capacity,
         cs.is_cancelled
    FROM course_sections cs
    JOIN subjects s ON s.id = cs.subject_id
`;

export interface SectionFilters {
  semester?: string;
  subjectId?: string;
  includeCancelled?: boolean;
}

export async function listCourseSections(
  filters: SectionFilters,
  db: Queryable = pool,
): Promise<CourseSection[]> {
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (filters.semester) {
    values.push(filters.semester);
    conditions.push(`cs.semester = $${values.length}`);
  }
  if (filters.subjectId) {
    values.push(filters.subjectId);
    conditions.push(`cs.subject_id = $${values.length}`);
  }
  if (!filters.includeCancelled) {
    conditions.push('cs.is_cancelled = false');
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await db.query<CourseSectionRow>(
    `${SECTION_SELECT} ${where}
      ORDER BY s.code, cs.section_code`,
    values,
  );
  return result.rows.map(mapSection);
}

export async function findCourseSectionsByIds(
  ids: string[],
  db: Queryable = pool,
): Promise<CourseSection[]> {
  if (ids.length === 0) return [];
  const result = await db.query<CourseSectionRow>(
    `${SECTION_SELECT} WHERE cs.id = ANY($1::uuid[]) ORDER BY s.code, cs.section_code`,
    [ids],
  );
  return result.rows.map(mapSection);
}

export async function findCourseSectionById(
  id: string,
  db: Queryable = pool,
): Promise<CourseSection | null> {
  const result = await db.query<CourseSectionRow>(`${SECTION_SELECT} WHERE cs.id = $1`, [id]);
  const row = result.rows[0];
  return row ? mapSection(row) : null;
}

const ITEM_SELECT = `
  SELECT id, section_id, title, semester, week_start, day_of_week, start_period, end_period,
         to_char(start_time, 'HH24:MI') AS start_time,
         to_char(end_time, 'HH24:MI') AS end_time,
         room, note, created_at
    FROM schedule_items
`;

export async function listScheduleItems(
  studentId: string,
  semester?: string,
  weekStart?: string,
  db: Queryable = pool,
): Promise<ScheduleItem[]> {
  const values: unknown[] = [studentId];
  let semesterFilter = '';

  if (semester) {
    values.push(semester);
    semesterFilter = 'AND (semester = $2 OR semester IS NULL)';
  }
  if (weekStart) {
    values.push(weekStart);
    semesterFilter += ` AND week_start = $${values.length}`;
  }

  const result = await db.query<ScheduleItemRow>(
    `${ITEM_SELECT}
      WHERE student_id = $1 ${semesterFilter}
      ORDER BY day_of_week, start_period, created_at`,
    values,
  );
  return result.rows.map(mapItem);
}

export async function findScheduleItem(
  studentId: string,
  itemId: string,
  db: Queryable = pool,
): Promise<ScheduleItem | null> {
  const result = await db.query<ScheduleItemRow>(
    `${ITEM_SELECT} WHERE id = $1 AND student_id = $2`,
    [itemId, studentId],
  );
  const row = result.rows[0];
  return row ? mapItem(row) : null;
}

export interface ScheduleItemInput {
  title: string;
  semester: string | null;
  weekStart: string;
  sectionId: string | null;
  dayOfWeek: number;
  startPeriod: number;
  endPeriod: number;
  startTime: string;
  endTime: string;
  room: string | null;
  note: string | null;
}

export async function insertScheduleItem(
  studentId: string,
  input: ScheduleItemInput,
  db: Queryable = pool,
): Promise<ScheduleItem> {
  const result = await db.query<ScheduleItemRow>(
    `INSERT INTO schedule_items
       (student_id, section_id, title, semester, week_start, day_of_week, start_period, end_period, start_time, end_time, room, note)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING id, section_id, title, semester, week_start, day_of_week, start_period, end_period,
               to_char(start_time, 'HH24:MI') AS start_time,
               to_char(end_time, 'HH24:MI') AS end_time, room, note, created_at`,
    [
      studentId,
      input.sectionId,
      input.title,
      input.semester,
      input.weekStart,
      input.dayOfWeek,
      input.startPeriod,
      input.endPeriod,
      input.startTime,
      input.endTime,
      input.room,
      input.note,
    ],
  );
  const row = result.rows[0];
  if (!row) throw new Error('Failed to create schedule item');
  return mapItem(row);
}

export async function updateScheduleItem(
  studentId: string,
  itemId: string,
  input: ScheduleItemInput,
  db: Queryable = pool,
): Promise<ScheduleItem | null> {
  const result = await db.query<ScheduleItemRow>(
    `UPDATE schedule_items
        SET section_id = $3,
            title = $4,
            semester = $5,
            week_start = $6,
            day_of_week = $7,
            start_period = $8,
            end_period = $9,
            start_time = $10,
            end_time = $11,
            room = $12,
            note = $13
      WHERE id = $1 AND student_id = $2
      RETURNING id, section_id, title, semester, week_start, day_of_week, start_period, end_period,
                to_char(start_time, 'HH24:MI') AS start_time,
                to_char(end_time, 'HH24:MI') AS end_time, room, note, created_at`,
    [
      itemId,
      studentId,
      input.sectionId,
      input.title,
      input.semester,
      input.weekStart,
      input.dayOfWeek,
      input.startPeriod,
      input.endPeriod,
      input.startTime,
      input.endTime,
      input.room,
      input.note,
    ],
  );
  const row = result.rows[0];
  return row ? mapItem(row) : null;
}

export async function deleteScheduleItem(
  studentId: string,
  itemId: string,
  db: Queryable = pool,
): Promise<boolean> {
  const result = await db.query(
    'DELETE FROM schedule_items WHERE id = $1 AND student_id = $2',
    [itemId, studentId],
  );
  return (result.rowCount ?? 0) > 0;
}
