import { AppError } from '../../lib/errors';
import { simulateSchedule } from './schedule.engine';
import { isSectionActiveInWeek, formatDateOnly, parseDateOnly, toDateString, weekRangeFor } from './schedule.range';
import * as repository from './schedule.repository';
import type {
  CourseSection,
  ScheduleConflict,
  ScheduleItem,
  ScheduleMeeting,
} from './schedule.types';
import type { CreateScheduleItemInput, UpdateScheduleItemInput } from './schedule.schemas';

export async function listPeriods() {
  return repository.listPeriodSlots();
}

export async function listSemesters() {
  return repository.listSemesters();
}

export async function listRegistrationConfigs(semester?: string) {
  return repository.listRegistrationConfigs(semester);
}

export async function getRegistrationConfig(semester: string) {
  return repository.findRegistrationConfig(semester);
}

export async function updateRegistrationConfig(
  semester: string,
  isOpen: boolean,
  openedAt: string | null,
  closedAt: string | null,
) {
  return repository.upsertRegistrationConfig(semester, isOpen, openedAt, closedAt);
}

export async function listSections(filters: {
  semester?: string;
  subjectId?: string;
  includeCancelled?: boolean;
}) {
  const sections = await repository.listCourseSections(filters);
  const semesterStarts = await repository.listSemesterStartDates(
    [...new Set(sections.map((section) => section.semester))],
  );
  return sections.map((section) => ({
    ...section,
    skippedWeekDates: skippedWeekDates(section, semesterStarts.get(section.semester)),
  }));
}

/**
 * Monday of the first week of a semester. Used to convert week numbers
 * ("tuần 3") into concrete dates so the calendar can skip them.
 *
 * Mốc tuần 1 = tuần chứa ngày bắt đầu học kỳ; nếu học kỳ chưa có ngày bắt đầu
 * thì lấy ngày bắt đầu của chính lớp đó.
 */
function semesterStartMonday(
  startDate: string | null | undefined,
  fallback?: string | null,
): Date | null {
  // Giá trị từ Postgres có thể là Date object (cột `date`) — chuẩn hoá trước.
  const raw = toDateString(startDate) ?? toDateString(fallback) ?? null;
  if (!raw) return null;
  const date = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  const day = date.getDay();
  date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day));
  return date;
}

/** Dates (YYYY-MM-DD) of the weeks the class does not meet. */
function skippedWeekDates(
  section: CourseSection,
  semesterStart: string | null | undefined,
): string[] {
  if (!section.skippedWeeks?.length) return [];
  const monday = semesterStartMonday(semesterStart, section.startDate);
  if (!monday) return [];

  return section.skippedWeeks
    .map((week) => {
      const date = new Date(monday);
      date.setDate(date.getDate() + (week - 1) * 7);
      return formatDateOnly(date);
    })
    .sort();
}

function sectionToMeeting(section: CourseSection, suffix = ''): ScheduleMeeting {
  return {
    id: `${section.id}${suffix}`,
    kind: 'section',
    code: section.sectionCode,
    title: `${section.subjectCode} — ${section.subjectName}`,
    dayOfWeek: section.dayOfWeek,
    startPeriod: section.startPeriod,
    endPeriod: section.endPeriod,
    room: section.room,
    isCancelled: section.isCancelled,
    sectionId: section.id,
  };
}

function sectionToMeetings(section: CourseSection): ScheduleMeeting[] {
  const meetings = [sectionToMeeting(section)];
  if (
    section.secondDayOfWeek !== null &&
    section.secondStartPeriod !== null &&
    section.secondEndPeriod !== null
  ) {
    meetings.push({
      ...sectionToMeeting(section, '-2'),
      dayOfWeek: section.secondDayOfWeek,
      startPeriod: section.secondStartPeriod,
      endPeriod: section.secondEndPeriod,
    });
  }
  return meetings;
}

function itemToMeeting(item: ScheduleItem): ScheduleMeeting {
  return {
    id: item.id,
    kind: 'item',
    code: 'CÁ NHÂN',
    title: item.title,
    dayOfWeek: item.dayOfWeek,
    startPeriod: item.startPeriod,
    endPeriod: item.endPeriod,
    room: item.room,
    isCancelled: false,
    sectionId: item.sectionId,
  };
}

/**
 * Check if registration is open for the given semester.
 * Returns true if registration is open, false if closed.
 * Throws AppError if no config exists for the semester.
 */
export async function checkRegistrationOpen(semester: string): Promise<boolean> {
  const config = await getRegistrationConfig(semester);
  if (!config) {
    // If no config exists, registration is considered open by default
    return true;
  }
  return config.isOpen;
}

/**
 * Simulate registration for a set of sections. Saved personal items are included
 * so the result warns about clashes with the student's existing calendar.
 */
export async function simulate(
  studentId: string,
  input: { semester: string; sectionIds: string[]; includeSavedItems?: boolean; weekStart?: string },
) {
  const sectionIds = [...new Set(input.sectionIds)];
  
  // Check if registration is open for this semester
  const isOpen = await checkRegistrationOpen(input.semester);
  if (!isOpen) {
    throw AppError.badRequest('Đăng ký cho học kỳ này đã bị khóa.');
  }

  const [sections, periods] = await Promise.all([
    repository.findCourseSectionsByIds(sectionIds),
    repository.listPeriodSlots(),
  ]);

  if (sections.length !== sectionIds.length) {
    throw AppError.badRequest('One or more selected sections do not exist');
  }

  const wrongSemester = sections.filter((section) => section.semester !== input.semester);
  if (wrongSemester.length > 0) {
    throw AppError.badRequest('All selected sections must belong to the requested semester');
  }

  const savedItems =
    input.includeSavedItems === false
      ? []
      : await repository.listScheduleItems(studentId, input.semester, input.weekStart);

  // Chỉ các lớp đang diễn ra trong tuần đang xem mới gây xung đột.
  // Lớp đã kết thúc (ngoài khoảng ngày bắt đầu – kết thúc) không xung đột
  // với lớp khác ở những tuần sau.
  const { start: weekStart, end: weekEnd } = input.weekStart
    ? weekRangeFor(parseDateOnly(input.weekStart))
    : { start: new Date(0), end: new Date(8640000000000000) };

  // Lớp nghỉ ở tuần đang xem cũng không gây xung đột.
  const semesterStarts = await repository.listSemesterStartDates(
    [...new Set(sections.map((section) => section.semester))],
  );
  const skippedThisWeek = new Set(
    sections
      .filter((section) =>
        skippedWeekDates(section, semesterStarts.get(section.semester)).includes(
          input.weekStart ?? '',
        ),
      )
      .map((section) => section.id),
  );

  const runningThisWeek = sections.filter(
    (section) =>
      !skippedThisWeek.has(section.id) &&
      isSectionActiveInWeek(section, weekStart, weekEnd),
  );

  const meetings = [
    ...runningThisWeek.flatMap(sectionToMeetings),
    ...savedItems.map(itemToMeeting),
  ];
  const result = simulateSchedule(meetings);

  // Tín chỉ và số lớp tính theo cả học kỳ (đăng ký là cho cả kỳ).
  const activeSections = sections.filter((section) => !section.isCancelled);
  const credits = [...new Set(activeSections.map((section) => section.subjectId))].reduce(
    (sum, subjectId) =>
      sum + (activeSections.find((section) => section.subjectId === subjectId)?.credits ?? 0),
    0,
  );

  // Lớp bị huỷ là trạng thái của cả học kỳ, không phụ thuộc tuần đang xem.
  const cancelledSectionIds = sections
    .filter((section) => section.isCancelled)
    .map((section) => section.id);

  return {
    semester: input.semester,
    // Kèm ngày của các tuần nghỉ để lịch tuần biết lớp nào đang nghỉ.
    sections: sections.map((section) => ({
      ...section,
      skippedWeekDates: skippedWeekDates(section, semesterStarts.get(section.semester)),
    })),
    items: savedItems,
    periods,
    conflicts: result.conflicts,
    cancelledSectionIds,
    summary: {
      sectionCount: activeSections.length,
      selectedCount: sections.length,
      credits,
      conflictCount: result.conflicts.length,
      feasible: result.conflicts.length === 0 && cancelledSectionIds.length === 0,
    },
  };
}

async function itemConflicts(studentId: string, semester: string | null, weekStart: string): Promise<ScheduleConflict[]> {
  const items = await repository.listScheduleItems(studentId, semester ?? undefined, weekStart);
  return simulateSchedule(items.map(itemToMeeting)).conflicts;
}

function conflictsFor(itemId: string, conflicts: ScheduleConflict[]): ScheduleConflict[] {
  return conflicts.filter(
    (conflict) => conflict.first.id === itemId || conflict.second.id === itemId,
  );
}

export async function listItems(studentId: string, semester?: string, weekStart?: string) {
  return repository.listScheduleItems(studentId, semester, weekStart);
}

export async function createItem(studentId: string, input: CreateScheduleItemInput) {
  if (input.sectionId) {
    const section = await repository.findCourseSectionById(input.sectionId);
    if (!section) throw AppError.badRequest('Linked course section does not exist');
  }

  const item = await repository.insertScheduleItem(studentId, {
    title: input.title,
    semester: input.semester ?? null,
    weekStart: input.weekStart,
    sectionId: input.sectionId ?? null,
    dayOfWeek: input.dayOfWeek,
    startPeriod: 1,
    endPeriod: 1,
    startTime: input.startTime,
    endTime: input.endTime,
    room: input.room ?? null,
    note: input.note ?? null,
  });

  const conflicts = await itemConflicts(studentId, item.semester, item.weekStart);
  return { item, conflicts: conflictsFor(item.id, conflicts) };
}

export async function updateItem(
  studentId: string,
  itemId: string,
  input: UpdateScheduleItemInput,
) {
  const existing = await repository.findScheduleItem(studentId, itemId);
  if (!existing) throw AppError.notFound('Schedule item not found');

  const next = {
    title: input.title ?? existing.title,
    semester: input.semester === undefined ? existing.semester : input.semester,
    weekStart: input.weekStart ?? existing.weekStart,
    sectionId: input.sectionId === undefined ? existing.sectionId : input.sectionId,
    dayOfWeek: input.dayOfWeek ?? existing.dayOfWeek,
    startPeriod: existing.startPeriod,
    endPeriod: existing.endPeriod,
    startTime: input.startTime ?? existing.startTime,
    endTime: input.endTime ?? existing.endTime,
    room: input.room === undefined ? existing.room : input.room,
    note: input.note === undefined ? existing.note : input.note,
  };

  if (next.sectionId) {
    const section = await repository.findCourseSectionById(next.sectionId);
    if (!section) throw AppError.badRequest('Linked course section does not exist');
  }

  const item = await repository.updateScheduleItem(studentId, itemId, next);
  if (!item) throw AppError.notFound('Schedule item not found');

  const conflicts = await itemConflicts(studentId, item.semester, item.weekStart);
  return { item, conflicts: conflictsFor(item.id, conflicts) };
}

export async function deleteItem(studentId: string, itemId: string): Promise<void> {
  const deleted = await repository.deleteScheduleItem(studentId, itemId);
  if (!deleted) throw AppError.notFound('Schedule item not found');
}
