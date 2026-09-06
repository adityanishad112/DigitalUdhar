import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, ok } from '../../core/http';
import { validate } from '../../middleware/validate';
import { USER_ROLES } from '../../db/schema/enums';
import {
  getDemoAccounts,
  quickLogin,
  resetDemoData,
  seedScenario,
} from './service';

export const demoRouter = Router();

// Retrieve available demo personas, shop QRs, and summary stats
demoRouter.get(
  '/accounts',
  asyncHandler(async (_req, res) => {
    const result = await getDemoAccounts();
    return ok(res, result);
  }),
);

// 1-click instant login for demo personas (skips manual SMS/OTP flow)
demoRouter.post(
  '/quick-login',
  validate({
    body: z.object({
      mobile: z.string().trim().regex(/^\d{10}$/),
      role: z.enum(USER_ROLES),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { mobile, role } = req.body;
    const result = await quickLogin(mobile, role);
    return ok(res, result);
  }),
);

// Reset demo state back to pristine demo seeds
demoRouter.post(
  '/reset',
  asyncHandler(async (_req, res) => {
    const result = await resetDemoData();
    return ok(res, result);
  }),
);

// Inject a live demo scenario (e.g. pending request or overdue request)
demoRouter.post(
  '/seed-scenario',
  validate({
    body: z.object({
      scenario: z.enum(['new_request', 'overdue_request']),
    }),
  }),
  asyncHandler(async (req, res) => {
    const result = await seedScenario(req.body.scenario);
    return ok(res, result);
  }),
);
