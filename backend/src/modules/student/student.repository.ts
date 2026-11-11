import type { Pool, PoolClient } from 'pg';
import { pool } from '../../database/pool';

export type Queryable = Pool | PoolClient;

export interface SubjectRecord {
  id: string;
  code: string;
  name: string;
  credits: number;
  processWeight: number;
  finalWeight: number;
  isActive: boolean;
}

export interface EnrollmentRecord {
  id: string;
  studentId: string;
  subjectId: string;
  semester: string;
  attemptNo: number;
  processScore: number | null;
  finalScore: number | null;
  letterGrade: string | null;
  grade4: number | null;
  isCountedInCpa: boolean;
}

export interface StudentProfile {
  id: string;
  email: string;
  fullName: string;
}

function toNumber(value: string | number | null): number | null {
  if (value === null) return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function findStudentProfile(
  studentId: string,
  db: Queryable = pool,
): Promise<StudentProfile | null> {
  const result = await db.query<{ id: string; email: string; full_name: string }>(
    'SELECT id, email, full_name FROM users WHERE id = $1',
    [studentId],
  );
  const row = result.rows[0];
  return row ? { id: row.id, email: row.email, fullName: row.full_name } : null;
}

export async function findSubject(
  subjectId: string,
  db: Queryable = pool,
): Promise<SubjectRecord | null> {
  const result = await db.query<{
    id: string;
    code: string;
    name: string;
    credits: number;
    process_weight: string;
    final_weight: string;
    is_active: boolean;
  }>(
    `SELECT id, code, name, credits, process_weight, final_weight, is_active
       FROM subjects
      WHERE id = $1`,
    [subjectId],
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    id: row.id,
    code: row.code,
    name: row.name,
    credits: row.credits,
    processWeight: Number(row.process_weight),
    finalWeight: Number(row.final_weight),
    isActive: row.is_active,
  };
}

export async function findEnrollment(
  studentId: string,
  enrollmentId: string,
  db: Queryable = pool,
): Promise<EnrollmentRecord | null> {
  const result = await db.query<{
    id: string;
    student_id: string;
    subject_id: string;
    semester: string;
    attempt_no: number;
    process_score: string | null;
    final_score: string | null;
    letter_grade: string | null;
    grade_4: string | null;
    is_counted_in_cpa: boolean;
  }>(
    `SELECT id, student_id, subject_id, semester, attempt_no,
            process_score, final_score, letter_grade, grade_4, is_counted_in_cpa
       FROM student_enrollments
      WHERE id = $1 AND student_id = $2`,
    [enrollmentId, studentId],
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    id: row.id,
    studentId: row.student_id,
    subjectId: row.subject_id,
    semester: row.semester,
    attemptNo: row.attempt_no,
    processScore: toNumber(row.process_score),
    finalScore: toNumber(row.final_score),
    letterGrade: row.letter_grade,
    grade4: toNumber(row.grade_4),
    isCountedInCpa: row.is_counted_in_cpa,
  };
}

export async function nextAttemptNo(
  studentId: string,
  subjectId: string,
  db: Queryable = pool,
): Promise<number> {
  const result = await db.query<{ next: number }>(
    `SELECT COALESCE(MAX(attempt_no), 0) + 1 AS next
       FROM student_enrollments
      WHERE student_id = $1 AND subject_id = $2`,
    [studentId, subjectId],
  );
  return result.rows[0]?.next ?? 1;
}

export async function insertEnrollment(
  input: {
    studentId: string;
    subjectId: string;
    semester: string;
    processScore: number | null;
    finalScore: number | null;
    letterGrade: string | null;
    grade4: number | null;
    attemptNo: number;
  },
  db: Queryable = pool,
): Promise<string> {
  const result = await db.query<{ id: string }>(
    `INSERT INTO student_enrollments
       (student_id, subject_id, semester, process_score, final_score,
        letter_grade, grade_4, is_counted_in_cpa, attempt_no)
     VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8)
     RETURNING id`,
    [
      input.studentId,
      input.subjectId,
      input.semester,
      input.processScore,
      input.finalScore,
      input.letterGrade,
      input.grade4,
      input.attemptNo,
    ],
  );

  const id = result.rows[0]?.id;
  if (!id) throw new Error('Failed to create enrollment');
  return id;
}

export async function updateEnrollment(
  input: {
    enrollmentId: string;
    studentId: string;
    semester: string;
    processScore: number;
    finalScore: number;
    letterGrade: string;
    grade4: number;
  },
  db: Queryable = pool,
): Promise<void> {
  const result = await db.query(
    `UPDATE student_enrollments
        SET semester = $3,
            process_score = $4,
            final_score = $5,
            letter_grade = $6,
            grade_4 = $7
      WHERE id = $1 AND student_id = $2`,
    [
      input.enrollmentId,
      input.studentId,
      input.semester,
      input.processScore,
      input.finalScore,
      input.letterGrade,
      input.grade4,
    ],
  );

  if (result.rowCount === 0) {
    throw new Error('Enrollment not found');
  }
}

export async function deleteEnrollment(
  enrollmentId: string,
  studentId: string,
  db: Queryable = pool,
): Promise<boolean> {
  const result = await db.query(
    'DELETE FROM student_enrollments WHERE id = $1 AND student_id = $2',
    [enrollmentId, studentId],
  );
  return (result.rowCount ?? 0) > 0;
}

export interface StudentMajor {
  id: string;
  code: string;
  name: string;
}

/** Primary major of a student (falls back to any assigned major). */
export async function findStudentMajor(
  studentId: string,
  db: Queryable = pool,
): Promise<StudentMajor | null> {
  const result = await db.query<{ id: string; code: string; name: string }>(
    `SELECT m.id, m.code, m.name
       FROM user_majors um
       JOIN majors m ON m.id = um.major_id
      WHERE um.user_id = $1
      ORDER BY um.is_primary DESC, m.code
      LIMIT 1`,
    [studentId],
  );
  return result.rows[0] ?? null;
}

export interface CurriculumSubjectRecord {
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  credits: number;
  isRequired: boolean;
  semesterNo: number | null;
  managingUnit: string;
  /** False = môn chỉ tính học phí, không tính vào điểm. */
  calculateGrade: boolean;
}

/** Personal study-plan semester overrides for a student. */
export async function listStudyPlanPlacements(
  studentId: string,
  db: Queryable = pool,
): Promise<Map<string, number>> {
  const result = await db.query<{ subject_id: string; semester_no: number }>(
    `SELECT subject_id, semester_no
       FROM student_study_plan
      WHERE student_id = $1`,
    [studentId],
  );
  return new Map(result.rows.map((row) => [row.subject_id, row.semester_no]));
}

/** Save (or overwrite) the student's desired semester for one subject. */
export async function saveStudyPlanPlacement(
  studentId: string,
  subjectId: string,
  semesterNo: number,
  db: Queryable = pool,
): Promise<void> {
  await db.query(
    `INSERT INTO student_study_plan (student_id, subject_id, semester_no)
     VALUES ($1, $2, $3)
     ON CONFLICT (student_id, subject_id)
     DO UPDATE SET semester_no = EXCLUDED.semester_no`,
    [studentId, subjectId, semesterNo],
  );
}

/** Remove a personal override so the subject follows the default programme again. */
export async function deleteStudyPlanPlacement(
  studentId: string,
  subjectId: string,
  db: Queryable = pool,
): Promise<void> {
  await db.query(
    `DELETE FROM student_study_plan WHERE student_id = $1 AND subject_id = $2`,
    [studentId, subjectId],
  );
}

/** Remove every personal override (back to the admin-defined programme). */
export async function resetStudyPlanPlacements(
  studentId: string,
  db: Queryable = pool,
): Promise<void> {
  await db.query(`DELETE FROM student_study_plan WHERE student_id = $1`, [studentId]);
}

/** Subjects in a major's training programme, ordered by planned semester. */
export async function listCurriculumSubjects(
  majorId: string,
  db: Queryable = pool,
): Promise<CurriculumSubjectRecord[]> {
  const result = await db.query<{
    subject_id: string;
    subject_code: string;
    subject_name: string;
    credits: number;
    is_required: boolean;
    semester_no: number | null;
    managing_unit: string;
    calculate_grade: boolean;
  }>(
    `SELECT s.id AS subject_id,
            s.code AS subject_code,
            s.name AS subject_name,
            s.credits,
            cs.is_required,
            cs.semester_no,
            s.managing_unit,
            cs.calculate_grade
       FROM curriculum_subjects cs
       JOIN subjects s ON s.id = cs.subject_id
      WHERE cs.major_id = $1
      ORDER BY cs.semester_no NULLS LAST, s.code`,
    [majorId],
  );
  return result.rows.map((row) => ({
    subjectId: row.subject_id,
    subjectCode: row.subject_code,
    subjectName: row.subject_name,
    credits: row.credits,
    isRequired: row.is_required,
    semesterNo: row.semester_no,
    managingUnit: row.managing_unit ?? '',
    calculateGrade: row.calculate_grade,
  }));
}

/** Managing units of arbitrary subjects (for subjects outside a programme). */
export async function listSubjectManagingUnits(
  subjectIds: string[],
  db: Queryable = pool,
): Promise<Map<string, string>> {
  if (!subjectIds.length) return new Map();
  const result = await db.query<{ id: string; managing_unit: string }>(
    `SELECT id, managing_unit FROM subjects WHERE id = ANY($1::uuid[])`,
    [subjectIds],
  );
  return new Map(result.rows.map((row) => [row.id, row.managing_unit ?? '']));
}
