import type {
  AttemptInput,
  CalculatedAttempt,
  ForecastInput,
  ForecastResult,
  GpaCalculation,
  GradeScale,
  SemesterCalculation,
  SubjectCalculation,
} from './gpa.types';

const EPSILON = 1e-9;

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Convert a 10-point score to the matching grade scale row.
 * Scales are thresholds: pick the highest minScore10 that is <= score.
 */
export function scoreToGrade(score10: number, scales: GradeScale[]): GradeScale | null {
  if (!Number.isFinite(score10) || score10 < 0 || score10 > 10) {
    return null;
  }

  let match: GradeScale | null = null;
  for (const scale of scales) {
    if (score10 + EPSILON >= scale.minScore10) {
      if (!match || scale.minScore10 > match.minScore10) {
        match = scale;
      }
    }
  }

  return match;
}

/** Composite 10-point score from process + final components. */
export function compositeScore(
  processScore: number,
  finalScore: number,
  processWeight: number,
): number {
  return round2(processScore * processWeight + finalScore * (1 - processWeight));
}

function isPassed(attempt: AttemptInput): boolean {
  return attempt.grade4 !== null && attempt.grade4 > 0;
}

/**
 * BR-RETENTION: one counted attempt per subject.
 *  - Retake (F → Pass): the passing attempt wins; the old F is not counted.
 *  - Improvement: among passing attempts, keep the highest 4-point grade.
 *  - Tie-break: the later attempt (higher attemptNo) wins.
 *  - Zero-credit subjects never affect CPA.
 */
function selectCounted(attempts: AttemptInput[]): AttemptInput | null {
  const graded = attempts.filter((attempt) => attempt.grade4 !== null);
  if (graded.length === 0) return null;

  const passing = graded.filter(isPassed);
  const candidates = passing.length > 0 ? passing : graded;

  return candidates.reduce((best, current) => {
    if (!best) return current;
    if ((current.grade4 ?? 0) > (best.grade4 ?? 0) + EPSILON) return current;
    if (
      Math.abs((current.grade4 ?? 0) - (best.grade4 ?? 0)) <= EPSILON &&
      current.attemptNo > best.attemptNo
    ) {
      return current;
    }
    return best;
  }, null as AttemptInput | null);
}

function attemptReason(attempt: AttemptInput, countedId: string | null, hasPassing: boolean): CalculatedAttempt['reason'] {
  if (attempt.grade4 === null) return 'ungraded';
  if (attempt.credits <= 0) return 'no-credits';
  if (attempt.id === countedId) return 'counted';
  if (!isPassed(attempt) && hasPassing) return 'not-passed';
  return 'superseded';
}

export function calculateGpa(attempts: AttemptInput[]): GpaCalculation {
  const bySubject = new Map<string, AttemptInput[]>();

  for (const attempt of attempts) {
    const group = bySubject.get(attempt.subjectId) ?? [];
    group.push(attempt);
    bySubject.set(attempt.subjectId, group);
  }

  const subjects: SubjectCalculation[] = [];
  const calculatedAttempts: CalculatedAttempt[] = [];

  let creditsAttempted = 0;
  let creditsEarned = 0;
  let weightedPoints = 0;
  let countedSubjects = 0;

  for (const group of bySubject.values()) {
    const first = group[0];
    if (!first) continue;

    const hasCredit = first.credits > 0;
    const counted = hasCredit ? selectCounted(group) : null;
    const hasPassing = group.some(isPassed);

    const subjectAttempts: CalculatedAttempt[] = group
      .slice()
      .sort((a, b) => a.attemptNo - b.attemptNo)
      .map((attempt) => ({
        ...attempt,
        counted: counted?.id === attempt.id,
        passed: isPassed(attempt),
        reason: attemptReason(attempt, counted?.id ?? null, hasPassing),
      }));

    calculatedAttempts.push(...subjectAttempts);

    if (counted && counted.grade4 !== null) {
      creditsAttempted += counted.credits;
      weightedPoints += counted.grade4 * counted.credits;
      if (isPassed(counted)) {
        creditsEarned += counted.credits;
      }
      countedSubjects += 1;
    }

    subjects.push({
      subjectId: first.subjectId,
      subjectCode: first.subjectCode,
      subjectName: first.subjectName,
      credits: first.credits,
      countedAttemptId: counted?.id ?? null,
      countedGrade4: counted?.grade4 ?? null,
      attempts: subjectAttempts,
    });
  }

  subjects.sort((a, b) => a.subjectCode.localeCompare(b.subjectCode));
  calculatedAttempts.sort(compareAttempts);

  const semesters = buildSemesterSummaries(calculatedAttempts);
  const cpa = creditsAttempted > 0 ? round2(weightedPoints / creditsAttempted) : 0;

  return {
    cpa,
    creditsAttempted,
    creditsEarned,
    countedSubjects,
    totalAttempts: attempts.length,
    subjects,
    semesters,
    attempts: calculatedAttempts,
  };
}

function compareAttempts(a: CalculatedAttempt, b: CalculatedAttempt): number {
  const bySemester = a.semester.localeCompare(b.semester);
  if (bySemester !== 0) return bySemester;
  const bySubject = a.subjectCode.localeCompare(b.subjectCode);
  if (bySubject !== 0) return bySubject;
  return a.attemptNo - b.attemptNo;
}

function buildSemesterSummaries(attempts: CalculatedAttempt[]): SemesterCalculation[] {
  const groups = new Map<string, CalculatedAttempt[]>();

  // Semester GPA reflects every graded attempt taken in that semester (including
  // an F later replaced for CPA), so a retake semester is not silently dropped.
  for (const attempt of attempts) {
    if (attempt.credits <= 0 || attempt.grade4 === null) continue;
    const group = groups.get(attempt.semester) ?? [];
    group.push(attempt);
    groups.set(attempt.semester, group);
  }

  return [...groups.entries()]
    .map(([semester, group]) => {
      const credits = group.reduce((sum, attempt) => sum + attempt.credits, 0);
      const points = group.reduce(
        (sum, attempt) => sum + (attempt.grade4 ?? 0) * attempt.credits,
        0,
      );
      return {
        semester,
        gpa: credits > 0 ? round2(points / credits) : 0,
        credits,
        earnedCredits: group
          .filter(isPassed)
          .reduce((sum, attempt) => sum + attempt.credits, 0),
      };
    })
    .sort((a, b) => a.semester.localeCompare(b.semester));
}

/**
 * Required average for the next `additionalCredits` to reach `targetCpa`.
 * `plannedGrade4` optionally projects the resulting CPA instead of the requirement.
 */
export function forecastCpa(input: ForecastInput): ForecastResult {
  const { cpa, credits, targetCpa, additionalCredits, plannedGrade4 } = input;

  const requiredAverage =
    additionalCredits > 0
      ? round2((targetCpa * (credits + additionalCredits) - cpa * credits) / additionalCredits)
      : 0;

  const projectedCpa =
    plannedGrade4 !== undefined && additionalCredits > 0
      ? round2((cpa * credits + plannedGrade4 * additionalCredits) / (credits + additionalCredits))
      : cpa;

  const feasible =
    additionalCredits > 0
      ? requiredAverage <= 4 + EPSILON && requiredAverage >= -EPSILON
      : cpa + EPSILON >= targetCpa;

  return {
    currentCpa: round2(cpa),
    currentCredits: credits,
    targetCpa: round2(targetCpa),
    additionalCredits,
    requiredAverageGrade4: Math.max(0, requiredAverage),
    projectedCpa,
    feasible,
  };
}
