import { describe, expect, it } from 'vitest';
import { isSectionActiveInWeek, parseDateOnly } from './schedule-range';

const week = (start: string, end: string): [Date, Date] => [
  parseDateOnly(start),
  parseDateOnly(end),
];

describe('parseDateOnly', () => {
  it('parses a YYYY-MM-DD value as a local date', () => {
    const date = parseDateOnly('2026-03-02');

    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(2);
    expect(date.getDate()).toBe(2);
  });
});

describe('isSectionActiveInWeek', () => {
  it('is always active without a date range', () => {
    expect(isSectionActiveInWeek({}, ...week('2026-01-05', '2026-01-11'))).toBe(true);
  });

  it('is active in a week fully inside the range', () => {
    const section = { startDate: '2026-01-01', endDate: '2026-03-31' };

    expect(isSectionActiveInWeek(section, ...week('2026-02-02', '2026-02-08'))).toBe(true);
  });

  it('is inactive in a week fully before the start date', () => {
    const section = { startDate: '2026-03-01', endDate: '2026-05-31' };

    expect(isSectionActiveInWeek(section, ...week('2026-02-02', '2026-02-08'))).toBe(false);
  });

  it('is inactive in a week fully after the end date', () => {
    const section = { startDate: '2026-01-01', endDate: '2026-02-28' };

    expect(isSectionActiveInWeek(section, ...week('2026-03-02', '2026-03-08'))).toBe(false);
  });

  it('is active in the boundary weeks (partial overlap)', () => {
    const section = { startDate: '2026-03-04', endDate: '2026-03-20' };

    // Week starts before the class but the class starts mid-week.
    expect(isSectionActiveInWeek(section, ...week('2026-03-02', '2026-03-08'))).toBe(true);
    // Week starts exactly on the first day of the class.
    expect(isSectionActiveInWeek(section, ...week('2026-03-09', '2026-03-15'))).toBe(true);
    // Week ends exactly on the last day of the class.
    expect(isSectionActiveInWeek(section, ...week('2026-03-16', '2026-03-22'))).toBe(true);
  });

  it('supports a single-sided range', () => {
    expect(isSectionActiveInWeek({ startDate: '2026-03-04' }, ...week('2026-03-02', '2026-03-08'))).toBe(true);
    expect(isSectionActiveInWeek({ startDate: '2026-03-04' }, ...week('2026-02-23', '2026-03-01'))).toBe(false);
    expect(isSectionActiveInWeek({ endDate: '2026-03-08' }, ...week('2026-03-09', '2026-03-15'))).toBe(false);
    expect(isSectionActiveInWeek({ endDate: '2026-03-08' }, ...week('2026-03-02', '2026-03-08'))).toBe(true);
  });
});
