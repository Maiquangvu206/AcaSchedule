import { calculateGpa, forecastCpa } from './gpa.engine';
import { listGradeScales, listStudentAttempts } from './gpa.repository';
import type { ForecastInput, GpaCalculation } from './gpa.types';

export async function getCalculation(studentId: string): Promise<GpaCalculation> {
  const attempts = await listStudentAttempts(studentId);
  return calculateGpa(attempts);
}

export interface ForecastInputWithoutBaseline {
  targetCpa: number;
  additionalCredits: number;
  plannedGrade4?: number;
}

export async function getForecast(studentId: string, input: ForecastInputWithoutBaseline) {
  const calculation = await getCalculation(studentId);
  const forecastInput: ForecastInput = {
    cpa: calculation.cpa,
    credits: calculation.creditsAttempted,
    targetCpa: input.targetCpa,
    additionalCredits: input.additionalCredits,
    ...(input.plannedGrade4 === undefined ? {} : { plannedGrade4: input.plannedGrade4 }),
  };

  return {
    ...forecastCpa(forecastInput),
    countedSubjects: calculation.countedSubjects,
  };
}

export { listGradeScales };
