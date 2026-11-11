import { describe, expect, it } from 'vitest';
import { calculateGpa, compositeScore, forecastCpa, round2, scoreToGrade } from '../src/modules/gpa/gpa.engine';
import type { AttemptInput, GradeScale } from '../src/modules/gpa/gpa.types';

const SCALES: GradeScale[] = [
  { minScore10: 9.0, letterGrade: 'A+', grade4: 4.0, isPass: true },
  { minScore10: 8.5, letterGrade: 'A', grade4: 4.0, isPass: true },
  { minScore10: 8.0, letterGrade: 'B+', grade4: 3.5, isPass: true },
  { minScore10: 7.0, letterGrade: 'B', grade4: 3.0, isPass: true },
  { minScore10: 6.5, letterGrade: 'C+', grade4: 2.5, isPass: true },
  { minScore10: 5.5, letterGrade: 'C', grade4: 2.0, isPass: true },
  { minScore10: 5.0, letterGrade: 'D+', grade4: 1.5, isPass: true },
  { minScore10: 4.0, letterGrade: 'D', grade4: 1.0, isPass: true },
  { minScore10: 0.0, letterGrade: 'F', grade4: 0.0, isPass: false },
];

function attempt(overrides: Partial<AttemptInput> & Pick<AttemptInput, 'id' | 'subjectId'>): AttemptInput {
  return {
    subjectCode: 'SUB101',
    subjectName: 'Subject',
    credits: 3,
    semester: '2024-1',
    attemptNo: 1,
    processScore: 8,
    finalScore: 8,
    totalScore10: 8,
    letterGrade: 'B+',
    grade4: 3.5,
    ...overrides,
  };
}

describe('scoreToGrade', () => {
  it('maps boundary scores to the correct scale row', () => {
    expect(scoreToGrade(9.0, SCALES)?.letterGrade).toBe('A+');
    expect(scoreToGrade(8.99, SCALES)?.letterGrade).toBe('A');
    expect(scoreToGrade(8.0, SCALES)?.letterGrade).toBe('B+');
    expect(scoreToGrade(4.0, SCALES)?.letterGrade).toBe('D');
    expect(scoreToGrade(3.99, SCALES)?.letterGrade).toBe('F');
  });

  it('rejects out-of-range scores', () => {
    expect(scoreToGrade(-1, SCALES)).toBeNull();
    expect(scoreToGrade(10.01, SCALES)).toBeNull();
    expect(scoreToGrade(Number.NaN, SCALES)).toBeNull();
  });
});

describe('compositeScore', () => {
  it('applies process/final weights', () => {
    expect(compositeScore(8, 6, 0.4)).toBe(6.8);
    expect(compositeScore(10, 10, 0.4)).toBe(10);
    expect(compositeScore(0, 0, 0.4)).toBe(0);
  });
});

describe('calculateGpa', () => {
  it('replaces the old F when a retake passes (BR-RETENTION)', () => {
    const result = calculateGpa([
      attempt({ id: 'a1', subjectId: 's1', attemptNo: 1, grade4: 0, letterGrade: 'F', semester: '2024-1' }),
      attempt({ id: 'a2', subjectId: 's1', attemptNo: 2, grade4: 2.5, letterGrade: 'C+', semester: '2025-1' }),
    ]);

    expect(result.cpa).toBe(2.5);
    expect(result.creditsAttempted).toBe(3);
    expect(result.creditsEarned).toBe(3);
    expect(result.attempts.find((item) => item.id === 'a1')?.counted).toBe(false);
    expect(result.attempts.find((item) => item.id === 'a1')?.reason).toBe('not-passed');
    expect(result.attempts.find((item) => item.id === 'a2')?.counted).toBe(true);
  });

  it('keeps the highest 4-point grade on improvement', () => {
    const result = calculateGpa([
      attempt({ id: 'a1', subjectId: 's1', attemptNo: 1, grade4: 3.0, letterGrade: 'B' }),
      attempt({ id: 'a2', subjectId: 's1', attemptNo: 2, grade4: 3.5, letterGrade: 'B+' }),
      attempt({ id: 'a3', subjectId: 's1', attemptNo: 3, grade4: 2.5, letterGrade: 'C+' }),
    ]);

    expect(result.cpa).toBe(3.5);
    expect(result.attempts.find((item) => item.id === 'a2')?.counted).toBe(true);
    expect(result.attempts.filter((item) => item.counted)).toHaveLength(1);
  });

  it('counts credits once across multiple passing attempts', () => {
    const result = calculateGpa([
      attempt({ id: 'a1', subjectId: 's1', credits: 4, grade4: 3.0 }),
      attempt({ id: 'a2', subjectId: 's1', credits: 4, grade4: 4.0 }),
      attempt({ id: 'b1', subjectId: 's2', credits: 3, grade4: 2.0, subjectCode: 'SUB102' }),
    ]);

    expect(result.creditsAttempted).toBe(7);
    expect(result.cpa).toBe(round2((4 * 4 + 2 * 3) / 7));
  });

  it('tie-breaks equal grades in favour of the later attempt', () => {
    const result = calculateGpa([
      attempt({ id: 'a1', subjectId: 's1', attemptNo: 1, grade4: 3.0 }),
      attempt({ id: 'a2', subjectId: 's1', attemptNo: 2, grade4: 3.0 }),
    ]);

    expect(result.attempts.find((item) => item.id === 'a2')?.counted).toBe(true);
  });

  it('ignores zero-credit subjects', () => {
    const result = calculateGpa([
      attempt({ id: 'a1', subjectId: 's1', credits: 0, grade4: 4 }),
      attempt({ id: 'b1', subjectId: 's2', credits: 3, grade4: 3 }),
    ]);

    expect(result.creditsAttempted).toBe(3);
    expect(result.cpa).toBe(3);
    expect(result.attempts.find((item) => item.id === 'a1')?.reason).toBe('no-credits');
  });

  it('returns CPA 0 for no graded attempts', () => {
    const result = calculateGpa([
      attempt({ id: 'a1', subjectId: 's1', grade4: null, letterGrade: null, totalScore10: null }),
    ]);

    expect(result.cpa).toBe(0);
    expect(result.creditsAttempted).toBe(0);
    expect(result.attempts[0]?.reason).toBe('ungraded');
  });

  it('keeps failing attempts counted when there is no passing attempt', () => {
    const result = calculateGpa([
      attempt({ id: 'a1', subjectId: 's1', grade4: 0, letterGrade: 'F' }),
    ]);

    expect(result.cpa).toBe(0);
    expect(result.creditsAttempted).toBe(3);
    expect(result.creditsEarned).toBe(0);
    expect(result.attempts[0]?.counted).toBe(true);
  });

  it('rounds CPA to two decimals', () => {
    const result = calculateGpa([
      attempt({ id: 'a1', subjectId: 's1', credits: 3, grade4: 3.5 }),
      attempt({ id: 'b1', subjectId: 's2', credits: 3, grade4: 3.0 }),
      attempt({ id: 'c1', subjectId: 's3', credits: 3, grade4: 2.5 }),
    ]);

    expect(result.cpa).toBe(3);
  });

  it('builds semester GPA from every graded attempt in that semester', () => {
    const result = calculateGpa([
      attempt({ id: 'a1', subjectId: 's1', semester: '2024-1', grade4: 2.0 }),
      attempt({ id: 'a2', subjectId: 's1', semester: '2025-1', grade4: 3.5 }),
      attempt({ id: 'b1', subjectId: 's2', semester: '2025-1', grade4: 3.0, subjectCode: 'SUB102' }),
    ]);

    expect(result.semesters).toHaveLength(2);
    expect(result.semesters[0]?.semester).toBe('2024-1');
    expect(result.semesters[0]?.gpa).toBe(2);
    expect(result.semesters[1]?.semester).toBe('2025-1');
    expect(result.semesters[1]?.gpa).toBe(round2((3.5 * 3 + 3.0 * 3) / 6));
  });

  it('never produces a CPA outside [0, 4] over random inputs', () => {
    for (let index = 0; index < 500; index += 1) {
      const attempts: AttemptInput[] = [];
      const subjectCount = 1 + Math.floor(Math.random() * 8);

      for (let subject = 0; subject < subjectCount; subject += 1) {
        const attemptCount = 1 + Math.floor(Math.random() * 4);
        for (let attemptNo = 1; attemptNo <= attemptCount; attemptNo += 1) {
          const grade4 = Math.round(Math.random() * 400) / 100;
          attempts.push(
            attempt({
              id: `s${subject}-a${attemptNo}`,
              subjectId: `s${subject}`,
              subjectCode: `SUB${subject}`,
              credits: 1 + Math.floor(Math.random() * 5),
              attemptNo,
              grade4,
              letterGrade: grade4 > 3.5 ? 'A' : grade4 > 2 ? 'B' : grade4 > 1 ? 'C' : 'F',
            }),
          );
        }
      }

      const result = calculateGpa(attempts);
      expect(result.cpa).toBeGreaterThanOrEqual(0);
      expect(result.cpa).toBeLessThanOrEqual(4);
    }
  });
});

describe('calculateGpa with per-major grade configuration', () => {
  it('excludes "tuition only" subjects from CPA, credits and semester GPA', () => {
    const result = calculateGpa([
      attempt({ id: 'a1', subjectId: 's1', credits: 3, grade4: 4.0, letterGrade: 'A' }),
      attempt({
        id: 'b1',
        subjectId: 's2',
        subjectCode: 'SUB102',
        credits: 2,
        grade4: 0.5,
        letterGrade: 'F',
        calculateGrade: false,
      }),
    ]);

    expect(result.cpa).toBe(4);
    expect(result.creditsAttempted).toBe(3);
    expect(result.creditsEarned).toBe(3);
    expect(result.countedSubjects).toBe(1);
    expect(result.attempts.find((item) => item.id === 'b1')?.counted).toBe(false);
    expect(result.attempts.find((item) => item.id === 'b1')?.reason).toBe('excluded');
    expect(result.subjects.find((item) => item.subjectId === 's2')?.countedAttemptId).toBeNull();
    expect(result.semesters[0]?.credits).toBe(3);
    expect(result.semesters[0]?.gpa).toBe(4);
  });

  it('honours the curriculumSubjects argument when attempts carry no flag', () => {
    const result = calculateGpa(
      [
        attempt({ id: 'a1', subjectId: 's1', grade4: 3.0 }),
        attempt({ id: 'b1', subjectId: 's2', subjectCode: 'SUB102', grade4: 2.0 }),
      ],
      [{ subjectId: 's2', calculateGrade: false }],
    );

    expect(result.cpa).toBe(3);
    expect(result.creditsAttempted).toBe(3);
    expect(result.attempts.find((item) => item.id === 'b1')?.reason).toBe('excluded');
  });
});

describe('creditsStudied', () => {
  it('counts every attempt, including failed subjects and retakes', () => {
    const result = calculateGpa([
      attempt({ id: 'a1', subjectId: 's1', credits: 3, grade4: 0, letterGrade: 'F', attemptNo: 1 }),
      attempt({ id: 'a2', subjectId: 's1', credits: 3, grade4: 2.5, attemptNo: 2 }),
      attempt({ id: 'b1', subjectId: 's2', subjectCode: 'SUB102', credits: 4, grade4: 3.0 }),
    ]);

    // 3 (F) + 3 (retake) + 4 = 10
    expect(result.creditsStudied).toBe(10);
    // CPA still counts each subject once.
    expect(result.creditsAttempted).toBe(7);
    expect(result.creditsEarned).toBe(7);
  });

  it('counts a failed subject with no retake', () => {
    const result = calculateGpa([
      attempt({ id: 'a1', subjectId: 's1', credits: 3, grade4: 0, letterGrade: 'F' }),
    ]);

    expect(result.creditsStudied).toBe(3);
    expect(result.creditsAttempted).toBe(3);
    expect(result.creditsEarned).toBe(0);
  });

  it('counts an improvement attempt again', () => {
    const result = calculateGpa([
      attempt({ id: 'a1', subjectId: 's1', credits: 3, grade4: 3.0, attemptNo: 1 }),
      attempt({ id: 'a2', subjectId: 's1', credits: 3, grade4: 3.5, attemptNo: 2 }),
    ]);

    expect(result.creditsStudied).toBe(6);
    expect(result.creditsAttempted).toBe(3);
    expect(result.creditsEarned).toBe(3);
  });

  it('includes "tuition only" subjects because they were studied', () => {
    const result = calculateGpa([
      attempt({ id: 'a1', subjectId: 's1', credits: 3, grade4: 4.0 }),
      attempt({
        id: 'b1',
        subjectId: 's2',
        subjectCode: 'SUB102',
        credits: 2,
        grade4: 0.5,
        letterGrade: 'F',
        calculateGrade: false,
      }),
    ]);

    expect(result.creditsStudied).toBe(5);
    expect(result.creditsAttempted).toBe(3);
    expect(result.creditsEarned).toBe(3);
  });

  it('ignores zero-credit subjects', () => {
    const result = calculateGpa([
      attempt({ id: 'a1', subjectId: 's1', credits: 0, grade4: 4 }),
      attempt({ id: 'b1', subjectId: 's2', credits: 3, grade4: 3 }),
    ]);

    expect(result.creditsStudied).toBe(3);
  });
});

describe('forecastCpa', () => {
  it('computes the required average for the next credits', () => {
    const result = forecastCpa({ cpa: 3.0, credits: 30, targetCpa: 3.2, additionalCredits: 15 });
    expect(result.requiredAverageGrade4).toBe(3.6);
    expect(result.feasible).toBe(true);
  });

  it('marks unreachable targets as infeasible', () => {
    const result = forecastCpa({ cpa: 2.0, credits: 60, targetCpa: 4.0, additionalCredits: 6 });
    expect(result.requiredAverageGrade4).toBeGreaterThan(4);
    expect(result.feasible).toBe(false);
  });

  it('projects CPA for a planned grade', () => {
    const result = forecastCpa({
      cpa: 3.0,
      credits: 30,
      targetCpa: 3.2,
      additionalCredits: 15,
      plannedGrade4: 3.6,
    });
    expect(result.projectedCpa).toBe(3.2);
  });

  it('handles zero additional credits', () => {
    const result = forecastCpa({ cpa: 3.5, credits: 30, targetCpa: 3.0, additionalCredits: 0 });
    expect(result.feasible).toBe(true);
  });

  it('marks target already met as feasible with any grade', () => {
    const result = forecastCpa({ cpa: 3.8, credits: 30, targetCpa: 3.5, additionalCredits: 15 });
    expect(result.requiredAverageGrade4).toBeGreaterThan(0);
    expect(result.requiredAverageGrade4).toBeLessThanOrEqual(4);
    expect(result.feasible).toBe(true);
  });

  it('rounds to two decimals for boundary values', () => {
    expect(round2(0.005)).toBe(0.01);
    expect(round2(0.004)).toBe(0);
    expect(round2(3.555)).toBe(3.56);
    expect(round2(3.554)).toBe(3.55);
  });
});
