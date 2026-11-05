import type {
  ConflictParty,
  ScheduleConflict,
  ScheduleMeeting,
  SimulationCore,
} from './schedule.types';

/**
 * Two period ranges overlap when they share at least one period.
 * Adjacent ranges (1-3 and 4-5) do not overlap.
 */
export function periodsOverlap(
  firstStart: number,
  firstEnd: number,
  secondStart: number,
  secondEnd: number,
): boolean {
  return firstStart <= secondEnd && secondStart <= firstEnd;
}

function toParty(meeting: ScheduleMeeting): ConflictParty {
  return {
    id: meeting.id,
    kind: meeting.kind,
    code: meeting.code,
    title: meeting.title,
    room: meeting.room,
  };
}

function conflictType(first: ScheduleMeeting, second: ScheduleMeeting): ScheduleConflict['type'] {
  return first.kind === 'section' && second.kind === 'section'
    ? 'section-section'
    : 'section-item';
}

/**
 * Compare every pair of meetings on the same day.
 *
 * Rules:
 *  - Cancelled sections never produce conflicts (they cannot be registered).
 *  - A personal item linked to one of the selected sections is the same meeting,
 *    so it is ignored instead of conflicting with itself.
 *  - Overlap is inclusive on periods: [start, end].
 */
export function findConflicts(meetings: ScheduleMeeting[]): ScheduleConflict[] {
  const selectedSectionIds = new Set(
    meetings
      .filter((meeting) => meeting.kind === 'section' && !meeting.isCancelled)
      .map((meeting) => meeting.id),
  );

  const active = meetings.filter((meeting) => {
    if (meeting.kind === 'section' && meeting.isCancelled) return false;
    if (meeting.kind === 'item' && meeting.sectionId && selectedSectionIds.has(meeting.sectionId)) {
      return false;
    }
    return meeting.startPeriod <= meeting.endPeriod;
  });

  const conflicts: ScheduleConflict[] = [];

  for (let firstIndex = 0; firstIndex < active.length; firstIndex += 1) {
    const first = active[firstIndex];
    if (!first) continue;

    for (let secondIndex = firstIndex + 1; secondIndex < active.length; secondIndex += 1) {
      const second = active[secondIndex];
      if (!second) continue;
      if (first.dayOfWeek !== second.dayOfWeek) continue;
      if (
        !periodsOverlap(first.startPeriod, first.endPeriod, second.startPeriod, second.endPeriod)
      ) {
        continue;
      }

      conflicts.push({
        type: conflictType(first, second),
        dayOfWeek: first.dayOfWeek,
        overlapStartPeriod: Math.max(first.startPeriod, second.startPeriod),
        overlapEndPeriod: Math.min(first.endPeriod, second.endPeriod),
        first: toParty(first),
        second: toParty(second),
      });
    }
  }

  return conflicts.sort((left, right) => {
    if (left.dayOfWeek !== right.dayOfWeek) return left.dayOfWeek - right.dayOfWeek;
    if (left.overlapStartPeriod !== right.overlapStartPeriod) {
      return left.overlapStartPeriod - right.overlapStartPeriod;
    }
    return left.second.id.localeCompare(right.second.id);
  });
}

/** Core simulation: cancelled sections are reported but never scheduled or compared. */
export function simulateSchedule(meetings: ScheduleMeeting[]): SimulationCore {
  const cancelledSectionIds = meetings
    .filter((meeting) => meeting.kind === 'section' && meeting.isCancelled)
    .map((meeting) => meeting.id);

  return {
    conflicts: findConflicts(meetings),
    cancelledSectionIds,
  };
}
