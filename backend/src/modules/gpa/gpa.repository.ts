import type { Pool, PoolClient } from 'pg';
import { pool } from '../../database/pool';
import type { AttemptInput, GradeScale } from './gpa.types';

export type Queryable = Pool | PoolClient;

function toNumber(value: string | number | null): number | null {
  if (value === null) return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

interface GradeScaleRow {
  min_score_10: string;
  letter_grade: string;
  grade_4: string;
  is_pass: boolean;
}

interface AttemptRow {
  id: string;
  subject_id: string;
  subject_code: string;
  subject_name: string;
  credits: number;
  semester: string;
  attempt_no: number;
  process_score: string | null;
  final_score: string | null;
  total_score_10: string | null;
  letter_grade: string | null;
  grade_4: string | null;
  calculate_grade: boolean;
  in_curriculum: boolean;
}

export interface StudentMajorRow {
  id: string;
  code: string;
  name: string;
  isPrimary: boolean;
}

/** Every major a student is enrolled in, primary programme first. */
export async function listStudentMajors(
  studentId: string,
  db: Queryable = pool,
): Promise<StudentMajorRow[]> {
  const result = await db.query<{ id: string; code: string; name: string; is_primary: boolean }>(
    `SELECT m.id, m.code, m.name, um.is_primary
       FROM user_majors um
       JOIN majors m ON m.id = um.major_id
      WHERE um.user_id = $1
      ORDER BY um.is_primary DESC, m.code`,
    [studentId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    isPrimary: row.is_primary,
  }));
}

export async function listGradeScales(db: Queryable = pool): Promise<GradeScale[]> {
  const result = await db.query<GradeScaleRow>(
    `SELECT min_score_10, letter_grade, grade_4, is_pass
       FROM grade_scales
      ORDER BY min_score_10 DESC`,
  );

  return result.rows.map((row) => ({
    minScore10: Number(row.min_score_10),
    letterGrade: row.letter_grade,
    grade4: Number(row.grade_4),
    isPass: row.is_pass,
  }));
}

/**
 * Attempt query. When `filterMajor` is true the programme configuration is
 * resolved for one specific major ($2) instead of the student's primary major,
 * which is what the per-major statistics need.
 */
function attemptSelect(filterMajor: boolean): string {
  return `
  SELECT e.id,
         e.subject_id,
         s.code AS subject_code,
         s.name AS subject_name,
         s.credits,
         e.semester,
         e.attempt_no,
         e.process_score,
         e.final_score,
         totals.total_score_10,
         COALESCE(scale.letter_grade, e.letter_grade) AS letter_grade,
         COALESCE(scale.grade_4, e.grade_4) AS grade_4,
         COALESCE(cc.calculate_grade, true) AS calculate_grade,
         (cc.subject_id IS NOT NULL) AS in_curriculum
    FROM student_enrollments e
    JOIN subjects s ON s.id = e.subject_id
    LEFT JOIN LATERAL (
      SELECT cs.subject_id, cs.process_weight, cs.final_weight, cs.calculate_grade
        FROM curriculum_subjects cs
        JOIN user_majors um
          ON um.major_id = cs.major_id
         AND um.user_id = e.student_id
       WHERE cs.subject_id = e.subject_id
         ${filterMajor ? 'AND cs.major_id = $2' : ''}
       ORDER BY um.is_primary DESC
       LIMIT 1
    ) cc ON true
    LEFT JOIN LATERAL (
      SELECT CASE
               WHEN e.process_score IS NULL OR e.final_score IS NULL THEN NULL
               ELSE ROUND(
                 e.process_score * COALESCE(cc.process_weight, s.process_weight)
                 + e.final_score * COALESCE(cc.final_weight, s.final_weight), 2)
             END AS total_score_10
    ) totals ON true
    LEFT JOIN LATERAL (
      SELECT gs.letter_grade, gs.grade_4
        FROM grade_scales gs
       WHERE totals.total_score_10 IS NOT NULL
         AND gs.min_score_10 <= totals.total_score_10
       ORDER BY gs.min_score_10 DESC
       LIMIT 1
    ) scale ON true
`;
}

const ATTEMPT_SELECT = attemptSelect(false);

function mapAttempt(row: AttemptRow): AttemptInput {
  return {
    id: row.id,
    subjectId: row.subject_id,
    subjectCode: row.subject_code,
    subjectName: row.subject_name,
    credits: row.credits,
    semester: row.semester,
    attemptNo: row.attempt_no,
    processScore: toNumber(row.process_score),
    finalScore: toNumber(row.final_score),
    totalScore10: toNumber(row.total_score_10),
    letterGrade: row.letter_grade,
    grade4: toNumber(row.grade_4),
    calculateGrade: row.calculate_grade,
    inCurriculum: Boolean(row.in_curriculum),
  };
}

export async function listStudentAttempts(
  studentId: string,
  db: Queryable = pool,
): Promise<AttemptInput[]> {
  const result = await db.query<AttemptRow>(
    `${ATTEMPT_SELECT}
      WHERE e.student_id = $1
      ORDER BY e.semester, s.code, e.attempt_no`,
    [studentId],
  );
  return result.rows.map(mapAttempt);
}

/**
 * Attempts resolved against one training programme: weights and
 * `calculate_grade` come from that major's curriculum, and `inCurriculum`
 * marks whether the subject belongs to it.
 */
export async function listStudentMajorAttempts(
  studentId: string,
  majorId: string,
  db: Queryable = pool,
): Promise<AttemptInput[]> {
  const result = await db.query<AttemptRow>(
    `${attemptSelect(true)}
      WHERE e.student_id = $1
      ORDER BY e.semester, s.code, e.attempt_no`,
    [studentId, majorId],
  );
  return result.rows.map(mapAttempt);
}

export async function listSubjectAttempts(
  studentId: string,
  subjectId: string,
  db: Queryable = pool,
): Promise<AttemptInput[]> {
  const result = await db.query<AttemptRow>(
    `${ATTEMPT_SELECT}
      WHERE e.student_id = $1 AND e.subject_id = $2
      ORDER BY e.attempt_no`,
    [studentId, subjectId],
  );
  return result.rows.map(mapAttempt);
}
