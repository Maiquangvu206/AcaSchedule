import { describe, expect, it } from 'vitest';
import { calculateGpa } from '../src/modules/gpa/gpa.engine';
import type { AttemptInput } from '../src/modules/gpa/gpa.types';

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
    inCurriculum: true,
    ...overrides,
  };
}

/**
 * Tiến độ so với mốc tối thiểu của ngành.
 *
 * - Chỉ tính môn tính điểm (calculate_grade = true).
 * - Tín chỉ đã đạt đếm một lần mỗi môn, kể cả khi học lại.
 * - Vượt mốc vẫn được (isComplete = true).
 */
describe('major progress', () => {
  it('counts only passed, graded subjects towards the minimum', () => {
    const calculation = calculateGpa([
      attempt({ id: 'a1', subjectId: 's1', credits: 3, grade4: 3.0 }),
      attempt({ id: 'b1', subjectId: 's2', subjectCode: 'SUB102', credits: 4, grade4: 0, letterGrade: 'F' }),
    ]);

    // 3 TC đạt + 4 TC trượt = 7 TC tính CPA, nhưng chỉ 3 TC đạt.
    expect(calculation.creditsEarned).toBe(3);
    expect(calculation.creditsAttempted).toBe(7);
  });

  it('excludes "tuition only" subjects from the accumulated credits', () => {
    const calculation = calculateGpa([
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

    expect(calculation.creditsEarned).toBe(3);
  });

  it('counts a retake only once towards the accumulated credits', () => {
    const calculation = calculateGpa([
      attempt({ id: 'a1', subjectId: 's1', attemptNo: 1, grade4: 0, letterGrade: 'F' }),
      attempt({ id: 'a2', subjectId: 's1', attemptNo: 2, grade4: 2.5 }),
    ]);

    expect(calculation.creditsEarned).toBe(3);
    expect(calculation.creditsStudied).toBe(6);
  });

  it('marks the programme complete when the earned credits reach the minimum', () => {
    const calculation = calculateGpa([
      attempt({ id: 'a1', subjectId: 's1', credits: 3, grade4: 3.0 }),
      attempt({ id: 'b1', subjectId: 's2', subjectCode: 'SUB102', credits: 4, grade4: 3.5 }),
    ]);

    const requiredCredits = 7;
    const earnedCredits = calculation.creditsEarned;

    expect(earnedCredits).toBe(7);
    expect(earnedCredits >= requiredCredits).toBe(true);
    expect(Math.round((earnedCredits / requiredCredits) * 100)).toBe(100);
  });

  it('allows exceeding the minimum without breaking the percentage', () => {
    const calculation = calculateGpa([
      attempt({ id: 'a1', subjectId: 's1', credits: 3, grade4: 3.0 }),
      attempt({ id: 'b1', subjectId: 's2', subjectCode: 'SUB102', credits: 4, grade4: 3.5 }),
    ]);

    const requiredCredits = 5;
    const earnedCredits = calculation.creditsEarned;
    const percent = Math.round((earnedCredits / requiredCredits) * 100);

    expect(earnedCredits).toBe(7);
    expect(percent).toBe(140);
    expect(earnedCredits >= requiredCredits).toBe(true);
  });
});
