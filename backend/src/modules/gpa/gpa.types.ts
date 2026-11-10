export interface GradeScale {
  minScore10: number;
  letterGrade: string;
  grade4: number;
  isPass: boolean;
}

export interface AttemptInput {
  id: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  credits: number;
  semester: string;
  attemptNo: number;
  processScore: number | null;
  finalScore: number | null;
  totalScore10: number | null;
  letterGrade: string | null;
  grade4: number | null;
  /** Per-major flag: false means the subject only tracks tuition, not CPA. */
  calculateGrade?: boolean;
}

export type CountReason =
  | 'counted'
  | 'superseded'
  | 'not-passed'
  | 'no-credits'
  | 'ungraded';

/**
 * How an attempt relates to the earlier attempts of the same subject:
 *  - `first`: first time the subject is taken
 *  - `retake`: taken again because an earlier attempt was not passed
 *  - `improvement`: taken again although an earlier attempt already passed
 */
export type AttemptKind = 'first' | 'retake' | 'improvement';

export interface CalculatedAttempt extends AttemptInput {
  counted: boolean;
  passed: boolean;
  reason: CountReason;
  attemptKind: AttemptKind;
  isRetake: boolean;
}

export interface SubjectCalculation {
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  credits: number;
  countedAttemptId: string | null;
  countedGrade4: number | null;
  attempts: CalculatedAttempt[];
}

export interface SemesterCalculation {
  semester: string;
  gpa: number;
  credits: number;
  earnedCredits: number;
}

export interface GpaCalculation {
  cpa: number;
  creditsAttempted: number;
  creditsEarned: number;
  countedSubjects: number;
  totalAttempts: number;
  subjects: SubjectCalculation[];
  semesters: SemesterCalculation[];
  attempts: CalculatedAttempt[];
}

export interface ForecastInput {
  cpa: number;
  credits: number;
  targetCpa: number;
  additionalCredits: number;
  plannedGrade4?: number;
}

export interface ForecastResult {
  currentCpa: number;
  currentCredits: number;
  targetCpa: number;
  additionalCredits: number;
  requiredAverageGrade4: number;
  projectedCpa: number;
  feasible: boolean;
}
