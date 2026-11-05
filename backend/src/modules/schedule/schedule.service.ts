import { AppError } from '../../lib/errors';
import { simulateSchedule } from './schedule.engine';
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

export async function listSections(filters: {
  semester?: string;
  subjectId?: string;
  includeCancelled?: boolean;
}) {
  return repository.listCourseSections(filters);
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
 * Simulate registration for a set of sections. Saved personal items are included
 * so the result warns about clashes with the student's existing calendar.
 */
export async function simulate(
  studentId: string,
  input: { semester: string; sectionIds: string[]; includeSavedItems?: boolean },
) {
  const sectionIds = [...new Set(input.sectionIds)];
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
      : await repository.listScheduleItems(studentId, input.semester);

  const meetings = [
    ...sections.flatMap(sectionToMeetings),
    ...savedItems.map(itemToMeeting),
  ];
  const result = simulateSchedule(meetings);

  const activeSections = sections.filter((section) => !section.isCancelled);
  const credits = [...new Set(activeSections.map((section) => section.subjectId))].reduce(
    (sum, subjectId) =>
      sum + (activeSections.find((section) => section.subjectId === subjectId)?.credits ?? 0),
    0,
  );

  return {
    semester: input.semester,
    sections,
    items: savedItems,
    periods,
    conflicts: result.conflicts,
    cancelledSectionIds: result.cancelledSectionIds,
    summary: {
      sectionCount: activeSections.length,
      selectedCount: sections.length,
      credits,
      conflictCount: result.conflicts.length,
      feasible: result.conflicts.length === 0 && result.cancelledSectionIds.length === 0,
    },
  };
}

async function itemConflicts(studentId: string, semester: string | null): Promise<ScheduleConflict[]> {
  const items = await repository.listScheduleItems(studentId, semester ?? undefined);
  return simulateSchedule(items.map(itemToMeeting)).conflicts;
}

function conflictsFor(itemId: string, conflicts: ScheduleConflict[]): ScheduleConflict[] {
  return conflicts.filter(
    (conflict) => conflict.first.id === itemId || conflict.second.id === itemId,
  );
}

export async function listItems(studentId: string, semester?: string) {
  return repository.listScheduleItems(studentId, semester);
}

export async function createItem(studentId: string, input: CreateScheduleItemInput) {
  if (input.sectionId) {
    const section = await repository.findCourseSectionById(input.sectionId);
    if (!section) throw AppError.badRequest('Linked course section does not exist');
  }

  const item = await repository.insertScheduleItem(studentId, {
    title: input.title,
    semester: input.semester ?? null,
    sectionId: input.sectionId ?? null,
    dayOfWeek: input.dayOfWeek,
    startPeriod: input.startPeriod,
    endPeriod: input.endPeriod,
    room: input.room ?? null,
    note: input.note ?? null,
  });

  const conflicts = await itemConflicts(studentId, item.semester);
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
    sectionId: input.sectionId === undefined ? existing.sectionId : input.sectionId,
    dayOfWeek: input.dayOfWeek ?? existing.dayOfWeek,
    startPeriod: input.startPeriod ?? existing.startPeriod,
    endPeriod: input.endPeriod ?? existing.endPeriod,
    room: input.room === undefined ? existing.room : input.room,
    note: input.note === undefined ? existing.note : input.note,
  };

  if (next.endPeriod < next.startPeriod) {
    throw AppError.badRequest('endPeriod must be greater than or equal to startPeriod');
  }

  if (next.sectionId) {
    const section = await repository.findCourseSectionById(next.sectionId);
    if (!section) throw AppError.badRequest('Linked course section does not exist');
  }

  const item = await repository.updateScheduleItem(studentId, itemId, next);
  if (!item) throw AppError.notFound('Schedule item not found');

  const conflicts = await itemConflicts(studentId, item.semester);
  return { item, conflicts: conflictsFor(item.id, conflicts) };
}

export async function deleteItem(studentId: string, itemId: string): Promise<void> {
  const deleted = await repository.deleteScheduleItem(studentId, itemId);
  if (!deleted) throw AppError.notFound('Schedule item not found');
}
