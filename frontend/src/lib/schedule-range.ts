/**
 * Helpers for the weekly timetable.
 *
 * A course section can define a start/end date range. It only happens in the
 * weeks that overlap that range, so navigating through the weeks shows the
 * class only while it is actually running.
 */

/** Parse a `YYYY-MM-DD` value as a local date (no timezone shift). */
export function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
}

/**
 * API cũ có thể trả ngày dạng ISO đầy đủ (`2026-11-09T00:00:00.000Z`) —
 * cắt 10 ký tự đầu để parse đúng; ghép thêm `T00:00:00` vào chuỗi đầy đủ
 * sẽ cho Invalid Date.
 */
export function toDateString(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.slice(0, 10);
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
  const startDate = toDateString(section.startDate);
  if (startDate) {
    const starts = parseDateOnly(startDate);
    // The whole week is before the class starts.
    if (weekEnd.getTime() < starts.getTime()) return false;
  }
  const endDate = toDateString(section.endDate);
  if (endDate) {
    const ends = parseDateOnly(endDate);
    // The whole week is after the class ended.
    if (weekStart.getTime() > ends.getTime()) return false;
  }
  return true;
}
