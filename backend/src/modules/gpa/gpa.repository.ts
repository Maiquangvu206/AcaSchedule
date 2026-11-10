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

const ATTEMPT_SELECT = `
  SELECT e.id,
         e.subject_id,
         s.code AS subject_code,
         s.name AS subject_name,
         s.credits,
         e.semester,
         e.attempt_no,
         e.process_score,
         e.final_score,
         CASE
           WHEN e.process_score IS NULL OR e.final_score IS NULL THEN NULL
           ELSE ROUND(
             e.process_score * COALESCE(cc.process_weight, s.process_weight)
             + e.final_score * COALESCE(cc.final_weight, s.final_weight), 2)
         END AS total_score_10,
         e.letter_grade,
         e.grade_4,
         COALESCE(cc.calculate_grade, true) AS calculate_grade
    FROM student_enrollments e
    JOIN subjects s ON s.id = e.subject_id
    LEFT JOIN LATERAL (
      SELECT cs.process_weight, cs.final_weight, cs.calculate_grade
        FROM curriculum_subjects cs
        JOIN user_majors um ON um.major_id = cs.major_id
       WHERE um.user_id = e.student_id AND cs.subject_id = e.subject_id
       ORDER BY um.is_primary DESC
       LIMIT 1
    ) cc ON true
`;

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
