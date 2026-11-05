import { Router } from 'express';
import { asyncHandler } from '../../lib/errors';
import { calculateSchema, forecastSchema } from './gpa.schemas';
import * as gpaService from './gpa.service';

export const gpaRouter = Router();

/** Full CPA calculation for the authenticated student. */
gpaRouter.post(
  '/calculate',
  asyncHandler(async (req, res) => {
    const { semester } = calculateSchema.parse(req.body ?? {});
    const calculation = await gpaService.getCalculation(req.user!.id);

    if (!semester) {
      res.json(calculation);
      return;
    }

    const semesterSummary = calculation.semesters.find((item) => item.semester === semester);
    res.json({
      ...calculation,
      requestedSemester: semester,
      semesterGpa: semesterSummary?.gpa ?? 0,
    });
  }),
);

/** Required average / projected CPA for a target. */
gpaRouter.post(
  '/forecast',
  asyncHandler(async (req, res) => {
    const input = forecastSchema.parse(req.body);
    const forecast = await gpaService.getForecast(req.user!.id, input);
    res.json(forecast);
  }),
);

/** Grade scales, useful for rendering score → letter conversions in the UI. */
gpaRouter.get(
  '/scales',
  asyncHandler(async (_req, res) => {
    const scales = await gpaService.listGradeScales();
    res.json({ scales });
  }),
);
