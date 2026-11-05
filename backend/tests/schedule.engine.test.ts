import { describe, expect, it } from 'vitest';
import { findConflicts, periodsOverlap, simulateSchedule } from '../src/modules/schedule/schedule.engine';
import type { ScheduleMeeting } from '../src/modules/schedule/schedule.types';

function meeting(overrides: Partial<ScheduleMeeting> & Pick<ScheduleMeeting, 'id'>): ScheduleMeeting {
  return {
    kind: 'section',
    code: 'SEC01',
    title: 'Lớp học phần',
    dayOfWeek: 2,
    startPeriod: 1,
    endPeriod: 3,
    room: 'A101',
    isCancelled: false,
    sectionId: null,
    ...overrides,
  };
}

describe('periodsOverlap', () => {
  it('does not treat adjacent periods as overlapping', () => {
    expect(periodsOverlap(1, 3, 4, 5)).toBe(false);
    expect(periodsOverlap(4, 5, 1, 3)).toBe(false);
  });

  it('detects a one-period overlap', () => {
    expect(periodsOverlap(1, 3, 3, 5)).toBe(true);
    expect(periodsOverlap(1, 6, 3, 4)).toBe(true);
  });
});

describe('findConflicts', () => {
  it('reports adjacent periods on the same day as free', () => {
    const conflicts = findConflicts([
      meeting({ id: 'a', startPeriod: 1, endPeriod: 3 }),
      meeting({ id: 'b', startPeriod: 4, endPeriod: 5, code: 'SEC02' }),
    ]);
    expect(conflicts).toHaveLength(0);
  });

  it('reports an overlap of exactly one period', () => {
    const conflicts = findConflicts([
      meeting({ id: 'a', startPeriod: 1, endPeriod: 3 }),
      meeting({ id: 'b', startPeriod: 3, endPeriod: 5, code: 'SEC02' }),
    ]);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({
      type: 'section-section',
      dayOfWeek: 2,
      overlapStartPeriod: 3,
      overlapEndPeriod: 3,
    });
  });

  it('does not report the same day in a different shift', () => {
    const conflicts = findConflicts([
      meeting({ id: 'a', startPeriod: 1, endPeriod: 3 }),
      meeting({ id: 'b', startPeriod: 6, endPeriod: 8, code: 'SEC02' }),
    ]);
    expect(conflicts).toHaveLength(0);
  });

  it('does not report different days', () => {
    const conflicts = findConflicts([
      meeting({ id: 'a', dayOfWeek: 2 }),
      meeting({ id: 'b', dayOfWeek: 3, code: 'SEC02' }),
    ]);
    expect(conflicts).toHaveLength(0);
  });

  it('reports full containment with the inner range as overlap', () => {
    const conflicts = findConflicts([
      meeting({ id: 'a', startPeriod: 1, endPeriod: 8 }),
      meeting({ id: 'b', startPeriod: 3, endPeriod: 4, code: 'SEC02' }),
    ]);

    expect(conflicts[0]?.overlapStartPeriod).toBe(3);
    expect(conflicts[0]?.overlapEndPeriod).toBe(4);
  });

  it('ignores cancelled sections entirely', () => {
    const conflicts = findConflicts([
      meeting({ id: 'a', isCancelled: true }),
      meeting({ id: 'b', code: 'SEC02' }),
    ]);

    expect(conflicts).toHaveLength(0);
    expect(simulateSchedule([meeting({ id: 'a', isCancelled: true })]).cancelledSectionIds).toEqual([
      'a',
    ]);
  });

  it('detects personal items conflicting with a section', () => {
    const conflicts = findConflicts([
      meeting({ id: 'a' }),
      meeting({
        id: 'item-1',
        kind: 'item',
        code: 'PERSONAL',
        title: 'Học nhóm',
        startPeriod: 3,
        endPeriod: 4,
      }),
    ]);

    expect(conflicts[0]?.type).toBe('section-item');
    expect(conflicts[0]?.second.kind).toBe('item');
  });

  it('does not compare a personal item with the selected section it copies', () => {
    const conflicts = findConflicts([
      meeting({ id: 'a' }),
      meeting({ id: 'item-1', kind: 'item', sectionId: 'a' }),
    ]);
    expect(conflicts).toHaveLength(0);
  });

  it('returns multiple conflicts ordered by day then period', () => {
    const conflicts = findConflicts([
      meeting({ id: 'a', dayOfWeek: 3, startPeriod: 6, endPeriod: 8 }),
      meeting({ id: 'b', dayOfWeek: 3, startPeriod: 7, endPeriod: 9 }),
      meeting({ id: 'c', dayOfWeek: 2, startPeriod: 1, endPeriod: 3 }),
      meeting({ id: 'd', dayOfWeek: 2, startPeriod: 2, endPeriod: 4 }),
    ]);

    expect(conflicts).toHaveLength(2);
    expect(conflicts[0]?.dayOfWeek).toBe(2);
    expect(conflicts[1]?.dayOfWeek).toBe(3);
  });

  it('accepts 20 non-overlapping sections as a feasible schedule', () => {
    const meetings: ScheduleMeeting[] = [];
    let index = 0;

    for (let day = 2; day <= 6; day += 1) {
      for (let block = 0; block < 4; block += 1) {
        const startPeriod = 1 + block * 3;
        meetings.push(
          meeting({
            id: `section-${index}`,
            code: `SECTION-${index}`,
            dayOfWeek: day,
            startPeriod,
            endPeriod: startPeriod + 1,
          }),
        );
        index += 1;
      }
    }

    expect(meetings).toHaveLength(20);
    expect(findConflicts(meetings)).toHaveLength(0);
  });

  it('reports cancelled sections but skips them in conflicts', () => {
    const result = simulateSchedule([
      meeting({ id: 'a', isCancelled: true }),
      meeting({ id: 'b', startPeriod: 1, endPeriod: 2 }),
      meeting({ id: 'c', startPeriod: 4, endPeriod: 5 }),
    ]);

    expect(result.cancelledSectionIds).toEqual(['a']);
    expect(result.conflicts).toHaveLength(0);
  });

  it('reports multiple conflicts on the same day between active sections only', () => {
    const result = simulateSchedule([
      meeting({ id: 'a', startPeriod: 1, endPeriod: 2 }),
      meeting({ id: 'b', startPeriod: 2, endPeriod: 3 }),
      meeting({ id: 'c', startPeriod: 3, endPeriod: 4 }),
      meeting({ id: 'd', startPeriod: 4, endPeriod: 5 }),
    ]);

    expect(result.conflicts).toHaveLength(3);
    expect(result.conflicts[0].overlapStartPeriod).toBe(2);
    expect(result.conflicts[1].overlapStartPeriod).toBe(3);
    expect(result.conflicts[2].overlapStartPeriod).toBe(4);
  });

  it('treats cancelled section as invisible even when overlapping active ones', () => {
    const result = simulateSchedule([
      meeting({ id: 'a', isCancelled: true, startPeriod: 1, endPeriod: 3 }),
      meeting({ id: 'b', startPeriod: 2, endPeriod: 4 }),
    ]);

    expect(result.cancelledSectionIds).toEqual(['a']);
    expect(result.conflicts).toHaveLength(0);
  });
});
