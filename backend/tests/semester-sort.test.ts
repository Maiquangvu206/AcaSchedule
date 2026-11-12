import { describe, expect, it } from 'vitest';
import { compareSemesters, compareSemestersDesc, semesterSortKey } from '../src/lib/semester-sort';

describe('semesterSortKey', () => {
  it('parses the "HK1 2024-2025" shape', () => {
    expect(semesterSortKey('HK1 2024-2025')).toEqual([2024, 1]);
    expect(semesterSortKey('HK2 2025-2026')).toEqual([2025, 2]);
  });

  it('parses the "2024-2025-1" shape', () => {
    expect(semesterSortKey('2024-2025-1')).toEqual([2024, 1]);
    expect(semesterSortKey('2024-2025-2')).toEqual([2024, 2]);
  });

  it('parses the short "2024-1" shape', () => {
    expect(semesterSortKey('2024-1')).toEqual([2024, 1]);
    expect(semesterSortKey('2024-2')).toEqual([2024, 2]);
  });

  it('falls back to [0, 0] for unknown shapes', () => {
    expect(semesterSortKey('abc')).toEqual([0, 0]);
  });
});

describe('compareSemesters', () => {
  it('orders by year first, then term', () => {
    const semesters = ['2024-2', '2023-1', '2024-10', '2024-1'];
    expect([...semesters].sort(compareSemesters)).toEqual([
      '2023-1',
      '2024-1',
      '2024-2',
      '2024-10',
    ]);
  });

  it('reverses for the descending variant', () => {
    const semesters = ['2024-2', '2023-1', '2024-1'];
    expect([...semesters].sort(compareSemestersDesc)).toEqual([
      '2024-2',
      '2024-1',
      '2023-1',
    ]);
  });

  it('does not confuse "2025-10" with "2025-2"', () => {
    expect(compareSemesters('2025-2', '2025-10')).toBeLessThan(0);
    expect(compareSemesters('2025-10', '2025-2')).toBeGreaterThan(0);
  });
});
