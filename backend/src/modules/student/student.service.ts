import type { PoolClient } from 'pg';
import { pool } from '../../database/pool';
import { AppError } from '../../lib/errors';
import { calculateGpa, compositeScore, scoreToGrade } from '../gpa/gpa.engine';
import { listGradeScales, listSubjectAttempts, listStudentAttempts } from '../gpa/gpa.repository';
import type { CalculatedAttempt, GpaCalculation } from '../gpa/gpa.types';
import {
  deleteEnrollment,
  deleteStudyPlanPlacement,
  findEnrollment,
  findStudentMajor,
  findStudentProfile,
  findSubject,
  insertEnrollment,
  listCurriculumSubjects,
  listStudyPlanPlacements,
  listSubjectManagingUnits,
  nextAttemptNo,
  resetStudyPlanPlacements,
  saveStudyPlanPlacement,
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
    attemptKind: attempt.attemptKind,
    isRetake: attempt.isRetake,
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
export async function createEnrollmentAdmin(
  studentId: string,
  input: { subjectId: string; semester: string; processScore?: number; finalScore?: number },
) {
  return withTransaction(async (client) => {
    const subject = await findSubject(input.subjectId, client);
    if (!subject || !subject.isActive) {
      throw AppError.notFound('Subject not found or inactive');
    }

    const hasProcess = input.processScore !== undefined && input.processScore !== null;
    const hasFinal = input.finalScore !== undefined && input.finalScore !== null;
    if (hasProcess !== hasFinal) {
      throw AppError.badRequest('Cần nhập cả điểm quá trình và điểm thi, hoặc để trống cả hai');
    }

    const grade = hasProcess && hasFinal
      ? await resolveGrade(subject, input.processScore!, input.finalScore!)
      : null;
    const attemptNo = await nextAttemptNo(studentId, subject.id, client);

    const id = await insertEnrollment(
      {
        studentId,
        subjectId: subject.id,
        semester: input.semester,
        processScore: hasProcess ? input.processScore! : null,
        finalScore: hasFinal ? input.finalScore! : null,
        letterGrade: grade?.letterGrade ?? null,
        grade4: grade?.grade4 ?? null,
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
export async function registerSections(studentId: string, semester: string, sectionIds: string[]) {  return withTransaction(async (client) => {
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

export type CurriculumSubjectStatus = 'not-started' | 'studying' | 'passed' | 'failed';

export interface CurriculumSubjectView {
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  credits: number;
  isRequired: boolean;
  semesterNo: number | null;
  /** Semester from the admin-defined programme (null = not planned). */
  defaultSemesterNo: number | null;
  /** Student's personal semester preference (null = follows the programme). */
  personalSemesterNo: number | null;
  /** Effective semester currently used for grouping. */
  effectiveSemesterNo: number | null;
  /** Bộ môn quản lý (managing unit) configured by admin. */
  managingUnit: string;
  isCustomized: boolean;
  /** False for subjects the student took that are not part of the programme. */
  inCurriculum: boolean;
  status: CurriculumSubjectStatus;
  attemptCount: number;
  /** Latest attempt, regardless of whether it has a grade yet. */
  latestAttempt: ReturnType<typeof toView> | null;
  attempts: ReturnType<typeof toView>[];
}

export interface CurriculumSemester {
  /** Planned semester number (1-based). 0 = not planned / outside the programme. */
  semesterNo: number;
  plannedCredits: number;
  completedCredits: number;
  subjects: CurriculumSubjectView[];
}

export interface TranscriptCurriculum {
  majorId: string;
  majorCode: string;
  majorName: string;
  maxSemesterNo: number;
  semesters: CurriculumSemester[];
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
  /** Study plan from the major's training programme, enriched with the student's attempts. */
  curriculum: TranscriptCurriculum | null;
}

function subjectStatus(
  attempts: ReturnType<typeof toView>[],
): CurriculumSubjectStatus {
  if (attempts.length === 0) return 'not-started';
  if (attempts.some((attempt) => attempt.passed)) return 'passed';
  const latest = attempts[attempts.length - 1];
  if (!latest || latest.grade4 === null) return 'studying';
  return 'failed';
}

/**
 * Arrange the student's subjects by the effective planned semester:
 * the student's personal placement wins, otherwise the semester from the
 * major's training programme (admin-defined) is used. Subjects that are not
 * in the programme are still shown in the "not planned" group so no attempt
 * disappears from the transcript.
 */
async function buildCurriculum(
  studentId: string,
  calculation: GpaCalculation,
): Promise<TranscriptCurriculum | null> {
  const major = await findStudentMajor(studentId);
  if (!major) return null;

  const [curriculumSubjects, placements] = await Promise.all([
    listCurriculumSubjects(major.id),
    listStudyPlanPlacements(studentId),
  ]);
  const subjectCalcById = new Map(
    calculation.subjects.map((subject) => [subject.subjectId, subject]),
  );
  const curriculumSubjectIds = new Set(curriculumSubjects.map((subject) => subject.subjectId));
  const outsideIds = calculation.subjects
    .filter((subject) => !curriculumSubjectIds.has(subject.subjectId))
    .map((subject) => subject.subjectId);
  const managingUnits = await listSubjectManagingUnits(outsideIds);

  const views: CurriculumSubjectView[] = curriculumSubjects.map((subject) => {
    const calc = subjectCalcById.get(subject.subjectId);
    const attempts = calc?.attempts.map(toView) ?? [];
    const defaultSemesterNo = subject.semesterNo;
    const personalSemesterNo = placements.get(subject.subjectId) ?? null;
    const effectiveSemesterNo = personalSemesterNo ?? defaultSemesterNo;
    return {
      subjectId: subject.subjectId,
      subjectCode: subject.subjectCode,
      subjectName: subject.subjectName,
      credits: subject.credits,
      isRequired: subject.isRequired,
      semesterNo: effectiveSemesterNo,
      defaultSemesterNo,
      personalSemesterNo,
      effectiveSemesterNo,
      managingUnit: subject.managingUnit,
      isCustomized: personalSemesterNo !== null,
      inCurriculum: true,
      status: subjectStatus(attempts),
      attemptCount: attempts.length,
      latestAttempt: attempts[attempts.length - 1] ?? null,
      attempts,
    };
  });

  // Keep attempts for subjects outside the programme visible.
  for (const subject of calculation.subjects) {
    if (curriculumSubjectIds.has(subject.subjectId)) continue;
    const attempts = subject.attempts.map(toView);
    const personalSemesterNo = placements.get(subject.subjectId) ?? null;
    views.push({
      subjectId: subject.subjectId,
      subjectCode: subject.subjectCode,
      subjectName: subject.subjectName,
      credits: subject.credits,
      isRequired: false,
      semesterNo: personalSemesterNo,
      defaultSemesterNo: null,
      personalSemesterNo,
      effectiveSemesterNo: personalSemesterNo,
      managingUnit: managingUnits.get(subject.subjectId) ?? '',
      isCustomized: personalSemesterNo !== null,
      inCurriculum: false,
      status: subjectStatus(attempts),
      attemptCount: attempts.length,
      latestAttempt: attempts[attempts.length - 1] ?? null,
      attempts,
    });
  }

  const groups = new Map<number, CurriculumSubjectView[]>();
  let maxSemesterNo = 0;
  for (const view of views) {
    const key = view.semesterNo ?? 0;
    maxSemesterNo = Math.max(maxSemesterNo, key);
    const group = groups.get(key) ?? [];
    group.push(view);
    groups.set(key, group);
  }

  const semesters: CurriculumSemester[] = [...groups.entries()]
    .map(([semesterNo, subjects]) => ({
      semesterNo,
      plannedCredits: subjects.reduce((sum, subject) => sum + subject.credits, 0),
      completedCredits: subjects
        .filter((subject) => subject.status === 'passed')
        .reduce((sum, subject) => sum + subject.credits, 0),
      subjects: subjects.sort((a, b) => a.subjectCode.localeCompare(b.subjectCode)),
    }))
    .sort((a, b) => (a.semesterNo === 0 ? 1 : b.semesterNo === 0 ? -1 : a.semesterNo - b.semesterNo));

  return {
    majorId: major.id,
    majorCode: major.code,
    majorName: major.name,
    maxSemesterNo,
    semesters,
  };
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
  const curriculum = await buildCurriculum(studentId, calculation);
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
    curriculum,
  };
}

export async function getEnrollmentById(studentId: string, enrollmentId: string) {
  const existing = await findEnrollment(studentId, enrollmentId);
  if (!existing) {
    throw AppError.notFound('Enrollment not found');
  }
  return existing;
}

/** Study plan of the student's major, with personal placements applied. */
export async function getStudyPlan(studentId: string) {
  const attempts = await listStudentAttempts(studentId);
  const calculation = calculateGpa(attempts);
  const curriculum = await buildCurriculum(studentId, calculation);
  if (!curriculum) {
    throw AppError.badRequest('Sinh viên chưa được gán ngành nên chưa có lộ trình học tập');
  }
  return curriculum;
}

/**
 * Move a subject to another semester in the student's personal plan.
 * Only subjects from the student's own major programme (or already taken)
 * may be placed, so the plan always stays scoped to the student's major.
 */
export async function updateStudyPlanPlacement(
  studentId: string,
  subjectId: string,
  semesterNo: number | null,
) {
  const attempts = await listStudentAttempts(studentId);
  const calculation = calculateGpa(attempts);
  const curriculum = await buildCurriculum(studentId, calculation);
  if (!curriculum) {
    throw AppError.badRequest('Sinh viên chưa được gán ngành');
  }
  const subject = curriculum.semesters
    .flatMap((semester) => semester.subjects)
    .find((item) => item.subjectId === subjectId);
  if (!subject) {
    throw AppError.notFound('Môn học không thuộc chương trình đào tạo của sinh viên');
  }
  if (semesterNo === null) {
    await deleteStudyPlanPlacement(studentId, subjectId);
  } else {
    await saveStudyPlanPlacement(studentId, subjectId, semesterNo);
  }
  return getStudyPlan(studentId);
}

/** Clear every personal placement, back to the admin-defined programme. */
export async function resetStudyPlan(studentId: string) {
  await resetStudyPlanPlacements(studentId);
  return getStudyPlan(studentId);
}

export type { EnrollmentRecord };
