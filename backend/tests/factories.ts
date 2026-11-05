/**
 * Test data builders (factories) for AcaSchedule backend tests.
 *
 * Provides fluent builders for domain entities so tests remain readable and
 * decoupled from database column names. Builders return plain objects ready
 * for repository insert calls or API request bodies.
 */

import type {
  AttemptInput,
  CalculatedAttempt,
  GradeScale,
} from '../src/modules/gpa/gpa.types';
import type { CreateEnrollmentInput } from '../src/modules/student/student.schemas';
import type { CourseSection, PeriodSlot } from '../src/modules/schedule/schedule.types';
import type { ScheduleItem } from '../src/modules/schedule/schedule.types';

const NEW_ID = () => crypto.randomUUID();

/** ---------- Grade scale ---------- */
export function gradeScale(overrides: Partial<GradeScale> = {}): GradeScale {
  return {
    id: NEW_ID(),
    minScore10: 0,
    letterGrade: 'F',
    grade4: 0,
    isPass: false,
    ...overrides,
  };
}

/** ---------- Subject ---------- */
export function subject(overrides: {
  id?: string;
  code?: string;
  name?: string;
  credits?: number;
  knowledgeBlock?: string;
  isActive?: boolean;
} = {}) {
  return {
    id: overrides.id ?? NEW_ID(),
    code: overrides.code ?? 'SUB101',
    name: overrides.name ?? 'Môn học mẫu',
    credits: overrides.credits ?? 3,
    knowledgeBlock: overrides.knowledgeBlock ?? 'Cơ bản',
    isActive: overrides.isActive ?? true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/** ---------- Attempt input ---------- */
export function attemptInput(
  overrides: Partial<AttemptInput> & Pick<AttemptInput, 'id' | 'subjectId'> = {} as any,
): AttemptInput {
  return {
    id: overrides.id ?? NEW_ID(),
    subjectId: overrides.subjectId ?? NEW_ID(),
    subjectCode: 'SUB101',
    subjectName: 'Môn học mẫu',
    credits: 3,
    semester: '2024-1',
    attemptNo: 1,
    processScore: 8,
    finalScore: 8,
    totalScore10: 8,
    letterGrade: 'B+',
    grade4: 3.5,
    ...overrides,
  };
}

/** ---------- Enrollment creation input ---------- */
export function createEnrollmentInput(
  overrides: Partial<CreateEnrollmentInput> = {},
): CreateEnrollmentInput {
  return {
    subjectId: overrides.subjectId ?? NEW_ID(),
    semester: overrides.semester ?? '2024-1',
    processScore: overrides.processScore ?? 8,
    finalScore: overrides.finalScore ?? 8,
    ...overrides,
  };
}

/** ---------- Calculated attempt ---------- */
export function calculatedAttempt(
  overrides: Partial<CalculatedAttempt> & Pick<AttemptInput, 'id' | 'subjectId'> = {} as any,
): CalculatedAttempt {
  return {
    ...attemptInput(overrides),
    counted: true,
    passed: true,
    reason: 'counted' as const,
    ...overrides,
  };
}

/** ---------- Course section ---------- */
export function courseSection(overrides: Partial<CourseSection> = {}): CourseSection {
  return {
    id: overrides.id ?? NEW_ID(),
    subjectId: overrides.subjectId ?? NEW_ID(),
    subjectCode: overrides.subjectCode ?? 'SUB101',
    subjectName: overrides.subjectName ?? 'Môn học mẫu',
    credits: overrides.credits ?? 3,
    semester: overrides.semester ?? '2025-2',
    sectionCode: overrides.sectionCode ?? 'SUB101-01',
    dayOfWeek: overrides.dayOfWeek ?? 2,
    startPeriod: overrides.startPeriod ?? 1,
    endPeriod: overrides.endPeriod ?? 3,
    room: overrides.room ?? 'A101',
    lecturer: overrides.lecturer ?? 'GV mẫu',
    capacity: overrides.capacity ?? 30,
    isCancelled: overrides.isCancelled ?? false,
  };
}

/** ---------- Period slot ---------- */
export function periodSlot(overrides: Partial<PeriodSlot> = {}): PeriodSlot {
  return {
    period: overrides.period ?? 1,
    startTime: overrides.startTime ?? '07:00',
    endTime: overrides.endTime ?? '07:50',
    label: overrides.label ?? 'Tiết 1',
  };
}

/** ---------- Schedule item ---------- */
export function scheduleItem(overrides: Partial<ScheduleItem> = {}): ScheduleItem {
  return {
    id: overrides.id ?? NEW_ID(),
    sectionId: overrides.sectionId ?? null,
    title: overrides.title ?? 'Lịch cá nhân mẫu',
    semester: overrides.semester ?? '2025-2',
    dayOfWeek: overrides.dayOfWeek ?? 2,
    startPeriod: overrides.startPeriod ?? 1,
    endPeriod: overrides.endPeriod ?? 2,
    room: overrides.room ?? null,
    note: overrides.note ?? null,
    createdAt: new Date().toISOString(),
  };
}

export { NEW_ID };
