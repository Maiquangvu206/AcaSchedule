import { Router } from 'express';
import { asyncHandler } from '../../lib/errors';
import {
  createScheduleItemSchema,
  listSectionsQuerySchema,
  simulateSchema,
  updateScheduleItemSchema,
} from './schedule.schemas';
import * as scheduleService from './schedule.service';

export const scheduleRouter = Router();

scheduleRouter.get(
  '/periods',
  asyncHandler(async (_req, res) => {
    const periods = await scheduleService.listPeriods();
    res.json({ periods });
  }),
);

scheduleRouter.get(
  '/semesters',
  asyncHandler(async (_req, res) => {
    const semesters = await scheduleService.listSemesters();
    res.json({ semesters });
  }),
);

/** Course sections for a semester, optionally filtered by subject. */
scheduleRouter.get(
  '/sections',
  asyncHandler(async (req, res) => {
    const query = listSectionsQuerySchema.parse(req.query);
    const sections = await scheduleService.listSections(query);
    res.json({ sections });
  }),
);

/** Simulate registration and return the weekly calendar + conflicts. */
scheduleRouter.post(
  '/simulate',
  asyncHandler(async (req, res) => {
    const input = simulateSchema.parse(req.body);
    const result = await scheduleService.simulate(req.user!.id, input);
    res.json(result);
  }),
);

/** Personal calendar items. */
scheduleRouter.get(
  '/items',
  asyncHandler(async (req, res) => {
    const semester = typeof req.query.semester === 'string' ? req.query.semester : undefined;
    const weekStart = typeof req.query.weekStart === 'string' ? req.query.weekStart : undefined;
    const items = await scheduleService.listItems(req.user!.id, semester, weekStart);
    res.json({ items });
  }),
);

scheduleRouter.post(
  '/items',
  asyncHandler(async (req, res) => {
    const input = createScheduleItemSchema.parse(req.body);
    const result = await scheduleService.createItem(req.user!.id, input);
    res.status(201).json(result);
  }),
);

scheduleRouter.patch(
  '/items/:id',
  asyncHandler(async (req, res) => {
    const input = updateScheduleItemSchema.parse(req.body);
    const result = await scheduleService.updateItem(req.user!.id, req.params.id, input);
    res.json(result);
  }),
);

scheduleRouter.delete(
  '/items/:id',
  asyncHandler(async (req, res) => {
    await scheduleService.deleteItem(req.user!.id, req.params.id);
    res.status(204).send();
  }),
);

scheduleRouter.get('/', (_req, res) => {
  res.json({
    module: 'schedule',
    endpoints: [
      'GET /api/schedule/periods',
      'GET /api/schedule/sections',
      'POST /api/schedule/simulate',
      'GET /api/schedule/items',
      'POST /api/schedule/items',
      'PATCH /api/schedule/items/:id',
      'DELETE /api/schedule/items/:id',
    ],
  });
});
