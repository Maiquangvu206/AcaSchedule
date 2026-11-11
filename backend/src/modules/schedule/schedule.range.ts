/**
 * Week helpers for the weekly timetable.
 *
 * A course section can define a start/end date range. It only happens in the
 * weeks that overlap that range, so a class that already finished must not
 * produce conflicts in later weeks.
 */

/** Parse a `YYYY-MM-DD` value as a local date (no timezone shift). */
export function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
}

export interface DateRangedSection {
  startDate?: string | null;
  endDate?: string | null;
}

/**
 * True when the week (inclusive) overlaps the section's date range.
 *
 * - No range configured → the section runs every week.
 * - The week lies completely before `startDate` → not yet started.
 * - The week lies completely after `endDate` → already finished.
 */
export function isSectionActiveInWeek(
  section: DateRangedSection,
  weekStart: Date,
  weekEnd: Date,
): boolean {
  if (section.startDate) {
    const starts = parseDateOnly(section.startDate);
    if (weekEnd.getTime() < starts.getTime()) return false;
  }
  if (section.endDate) {
    const ends = parseDateOnly(section.endDate);
    if (weekStart.getTime() > ends.getTime()) return false;
  }
  return true;
}

/** Monday-based week range that contains the given date. */
export function weekRangeFor(date: Date): { start: Date; end: Date } {
  const start = new Date(date);
  const day = start.getDay();
  start.setDate(start.getDate() + (day === 0 ? -6 : 1 - day));
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}
