import type { PoolClient } from 'pg';
import { pool } from '../../database/pool';
import { AppError } from '../../lib/errors';
import { calculateGpa, compositeScore, scoreToGrade } from '../gpa/gpa.engine';
import { listGradeScales, listSubjectAttempts, listStudentAttempts } from '../gpa/gpa.repository';
import type { CalculatedAttempt, GpaCalculation } from '../gpa/gpa.types';
import {
  deleteEnrollment,
  findEnrollment,
  findStudentProfile,
  findSubject,
  insertEnrollment,
  nextAttemptNo,
  updateEnrollment,
  type EnrollmentRecord,
  type SubjectRecord,
} from './student.repository';
import type { CreateEnrollmentInput, UpdateEnrollmentInput } from './student.schemas';

async function withTransaction<T>(handler: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await handler(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/** Recompute and persist effective CPA flags for one subject. */
async function syncSubjectCpaFlags(
  studentId: string,
  subjectId: string,
  client: PoolClient,
): Promise<void> {
  const attempts = await listSubjectAttempts(studentId, subjectId, client);
  const calculation = calculateGpa(attempts);
  const countedId = calculation.subjects[0]?.countedAttemptId ?? null;

  for (const attempt of attempts) {
    await client.query(
      `UPDATE student_enrollments
          SET is_counted_in_cpa = $1
        WHERE id = $2 AND student_id = $3`,
      [attempt.id === countedId, attempt.id, studentId],
    );
  }
}

async function resolveGrade(subject: SubjectRecord, processScore: number, finalScore: number) {
  const totalScore10 = compositeScore(processScore, finalScore, subject.processWeight);
  const scales = await listGradeScales();
  const scale = scoreToGrade(totalScore10, scales);

  if (!scale) {
    throw AppError.badRequest('Score falls outside the configured grade scales');
  }

  return {
    totalScore10,
    letterGrade: scale.letterGrade,
    grade4: scale.grade4,
  };
}

function toView(attempt: CalculatedAttempt) {
  return {
    id: attempt.id,
    subjectId: attempt.subjectId,
    subjectCode: attempt.subjectCode,
    subjectName: attempt.subjectName,
    credits: attempt.credits,
    semester: attempt.semester,
    attemptNo: attempt.attemptNo,
    processScore: attempt.processScore,
    finalScore: attempt.finalScore,
    totalScore10: attempt.totalScore10,
    letterGrade: attempt.letterGrade,
    grade4: attempt.grade4,
    passed: attempt.passed,
    countedInCpa: attempt.counted,
    reason: attempt.reason,
  };
}

export async function listEnrollments(studentId: string) {
  const attempts = await listStudentAttempts(studentId);
  const calculation = calculateGpa(attempts);
  return calculation.attempts.map(toView);
}

export async function createEnrollment(studentId: string, input: CreateEnrollmentInput) {
  return withTransaction(async (client) => {
    const subject = await findSubject(input.subjectId, client);

    if (!subject || !subject.isActive) {
      throw AppError.notFound('Subject not found or inactive');
    }

    const grade = await resolveGrade(subject, input.processScore, input.finalScore);
    const attemptNo = await nextAttemptNo(studentId, subject.id, client);

    const id = await insertEnrollment(
      {
        studentId,
        subjectId: subject.id,
        semester: input.semester,
        processScore: input.processScore,
        finalScore: input.finalScore,
        letterGrade: grade.letterGrade,
        grade4: grade.grade4,
        attemptNo,
      },
      client,
    );

    await syncSubjectCpaFlags(studentId, subject.id, client);

    const attempts = await listStudentAttempts(studentId, client);
    const calculation = calculateGpa(attempts);
    const created = calculation.attempts.find((attempt) => attempt.id === id);

    return {
      enrollment: created ? toView(created) : null,
      calculation: {
        cpa: calculation.cpa,
        creditsAttempted: calculation.creditsAttempted,
        creditsEarned: calculation.creditsEarned,
      },
    };
  });
}

/** Create pending transcript rows for sections selected during registration. */
export async function registerSections(studentId: string, semester: string, sectionIds: string[]) {
  return withTransaction(async (client) => {
    const sections = await client.query<{ subject_id: string; semester: string }>(
      `SELECT subject_id, semester FROM course_sections WHERE id = ANY($1::uuid[]) AND is_cancelled = false`, [sectionIds],
    );
    if (sections.rows.length !== new Set(sectionIds).size || sections.rows.some((row) => row.semester !== semester)) {
      throw AppError.badRequest('Lớp học phần không hợp lệ hoặc khác học kỳ');
    }
    const createdIds: string[] = [];
    for (const section of sections.rows) {
      const existing = (await listStudentAttempts(studentId, client)).find(
        (attempt) => attempt.subjectId === section.subject_id && attempt.semester === semester && attempt.processScore === null,
      );
      if (existing) { createdIds.push(existing.id); continue; }
      const attemptNo = await nextAttemptNo(studentId, section.subject_id, client);
      createdIds.push(await insertEnrollment({
        studentId, subjectId: section.subject_id, semester, processScore: null, finalScore: null,
        letterGrade: null, grade4: null, attemptNo,
      }, client));
    }
    return { enrollmentIds: createdIds };
  });
}

export async function updateEnrollmentById(
  studentId: string,
  enrollmentId: string,
  input: UpdateEnrollmentInput,
) {
  return withTransaction(async (client) => {
    const existing = await findEnrollment(studentId, enrollmentId, client);
    if (!existing) {
      throw AppError.notFound('Enrollment not found');
    }

    const subject = await findSubject(existing.subjectId, client);
    if (!subject) {
      throw AppError.notFound('Subject not found');
    }

    const processScore = input.processScore ?? existing.processScore;
    const finalScore = input.finalScore ?? existing.finalScore;

    if (processScore === null || finalScore === null) {
      throw AppError.badRequest('Both processScore and finalScore are required');
    }

    const grade = await resolveGrade(subject, processScore, finalScore);

    await updateEnrollment(
      {
        enrollmentId: existing.id,
        studentId,
        semester: input.semester ?? existing.semester,
        processScore,
        finalScore,
        letterGrade: grade.letterGrade,
        grade4: grade.grade4,
      },
      client,
    );

    await syncSubjectCpaFlags(studentId, subject.id, client);

    const attempts = await listStudentAttempts(studentId, client);
    const calculation = calculateGpa(attempts);
    const updated = calculation.attempts.find((attempt) => attempt.id === existing.id);

    return {
      enrollment: updated ? toView(updated) : null,
      calculation: {
        cpa: calculation.cpa,
        creditsAttempted: calculation.creditsAttempted,
        creditsEarned: calculation.creditsEarned,
      },
    };
  });
}

export async function deleteEnrollmentById(studentId: string, enrollmentId: string): Promise<void> {
  await withTransaction(async (client) => {
    const existing = await findEnrollment(studentId, enrollmentId, client);
    if (!existing) {
      throw AppError.notFound('Enrollment not found');
    }

    await deleteEnrollment(enrollmentId, studentId, client);
    await syncSubjectCpaFlags(studentId, existing.subjectId, client);
  });
}

export interface TranscriptSemester {
  semester: string;
  gpa: number;
  credits: number;
  earnedCredits: number;
  attempts: ReturnType<typeof toView>[];
}

export interface Transcript {
  student: { id: string; email: string; fullName: string };
  summary: {
    cpa: number;
    creditsAttempted: number;
    creditsEarned: number;
    countedSubjects: number;
    totalAttempts: number;
  };
  semesters: TranscriptSemester[];
}

export async function getTranscript(studentId: string): Promise<Transcript> {
  const [student, attempts] = await Promise.all([
    findStudentProfile(studentId),
    listStudentAttempts(studentId),
  ]);

  if (!student) {
    throw AppError.notFound('Student not found');
  }

  const calculation: GpaCalculation = calculateGpa(attempts);
  const semesterSummary = new Map(calculation.semesters.map((item) => [item.semester, item]));
  const bySemester = new Map<string, CalculatedAttempt[]>();

  for (const attempt of calculation.attempts) {
    const group = bySemester.get(attempt.semester) ?? [];
    group.push(attempt);
    bySemester.set(attempt.semester, group);
  }

  const semesters: TranscriptSemester[] = [...bySemester.entries()]
    .map(([semester, group]) => {
      const summary = semesterSummary.get(semester);
      return {
        semester,
        gpa: summary?.gpa ?? 0,
        credits: summary?.credits ?? 0,
        earnedCredits: summary?.earnedCredits ?? 0,
        attempts: group.map(toView),
      };
    })
    .sort((a, b) => b.semester.localeCompare(a.semester));

  return {
    student,
    summary: {
      cpa: calculation.cpa,
      creditsAttempted: calculation.creditsAttempted,
      creditsEarned: calculation.creditsEarned,
      countedSubjects: calculation.countedSubjects,
      totalAttempts: calculation.totalAttempts,
    },
    semesters,
  };
}

export async function getEnrollmentById(studentId: string, enrollmentId: string) {
  const existing = await findEnrollment(studentId, enrollmentId);
  if (!existing) {
    throw AppError.notFound('Enrollment not found');
  }
  return existing;
}

export type { EnrollmentRecord };
