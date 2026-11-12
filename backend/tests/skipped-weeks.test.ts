import { describe, expect, it } from 'vitest';
import {
  formatDateOnly,
  isSectionActiveInWeek,
  parseDateOnly,
  weekRangeFor,
} from '../src/modules/schedule/schedule.range';

/**
 * Tuần nghỉ: số tuần (1-based từ tuần đầu học kỳ) mà lớp không học.
 * Tuần 1 là tuần chứa ngày bắt đầu của học kỳ.
 */
function skippedWeekDates(
  skippedWeeks: number[],
  semesterStart: string,
): string[] {
  const monday = weekRangeFor(parseDateOnly(semesterStart)).start;
  return skippedWeeks
    .map((week) => {
      const date = new Date(monday);
      date.setDate(date.getDate() + (week - 1) * 7);
      return formatDateOnly(date);
    })
    .sort();
}

describe('skipped weeks', () => {
  it('turns week numbers into the Monday of that week', () => {
    // Học kỳ bắt đầu 2026-03-02 (một thứ Hai) → tuần 1 = 02/03, tuần 3 = 16/03.
    expect(skippedWeekDates([1, 3], '2026-03-02')).toEqual(['2026-03-02', '2026-03-16']);
  });

  it('counts weeks from the Monday of the semester start date', () => {
    // Học kỳ bắt đầu 2026-03-04 (thứ Tư) → tuần 1 vẫn là tuần chứa 04/03.
    expect(skippedWeekDates([1], '2026-03-04')).toEqual(['2026-03-02']);
  });

  it('returns an empty list when no week is skipped', () => {
    expect(skippedWeekDates([], '2026-03-02')).toEqual([]);
  });

  it('hides the class on a skipped week only', () => {
    const skipped = skippedWeekDates([2], '2026-03-02');
    const skippedWeek = parseDateOnly(skipped[0]);
    const nextWeek = new Date(skippedWeek);
    nextWeek.setDate(nextWeek.getDate() + 7);

    const range = weekRangeFor(skippedWeek);
    expect(skipped.includes(formatDateOnly(range.start))).toBe(true);

    const nextRange = weekRangeFor(nextWeek);
    expect(skipped.includes(formatDateOnly(nextRange.start))).toBe(false);
  });
});
