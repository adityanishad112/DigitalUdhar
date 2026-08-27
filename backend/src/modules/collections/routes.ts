import { Router } from 'express';
import { asyncHandler, ok } from '../../core/http';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { listReminders, runCollectionsSweep } from './service';

export const remindersRouter = Router();

// A user sees the reminders that concern them (as customer or as a shop).
remindersRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => ok(res, await listReminders(req.user!))),
);

// Admin-triggerable manual sweep (the cron worker runs it automatically too).
remindersRouter.post(
  '/run-sweep',
  requireAuth,
  requireRole('ADMIN'),
  asyncHandler(async (_req, res) => ok(res, await runCollectionsSweep())),
);
