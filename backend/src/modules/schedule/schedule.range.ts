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

/**
 * Postgres cột `date` trả về **Date object** (node-pg tự parse) và API cũ có
 * thể trả chuỗi ISO đầy đủ (`2026-11-09T00:00:00.000Z`). Chuẩn hoá về chuỗi
 * `yyyy-mm-dd` ngay tại ranh giới repository — nếu để Date object lọt vào
 * `parseDateOnly` (`value.split`) sẽ nổ TypeError → HTTP 500.
 *
 * Date object từ node-pg cho cột `date` là nửa đêm **giờ local**, nên dùng
 * getter local (không `toISOString` — lệch múi giờ về ngày trước ở UTC+7).
 */
export function toDateString(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  return formatDateOnly(value);
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
    if (weekEnd.getTime() < starts.getTime()) return false;
  }
  const endDate = toDateString(section.endDate);
  if (endDate) {
    const ends = parseDateOnly(endDate);
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

/**
 * Format a date as `YYYY-MM-DD` in LOCAL time.
 *
 * `toISOString()` converts to UTC, which shifts the date back one day in
 * Vietnam (UTC+7) — that would put every skipped week on the wrong day.
 */
export function formatDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
