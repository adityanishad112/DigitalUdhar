import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, created } from '../../core/http';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { createAdjustment } from './service';

export const adjustmentsRouter = Router();

// Merchant (owner) or admin records a correction. Never edits the original entry.
adjustmentsRouter.post(
  '/',
  requireAuth,
  requireRole('MERCHANT', 'ADMIN'),
  validate({
    body: z.object({
      udhaarId: z.string().min(1),
      amountPaise: z.number().int().refine((n) => n !== 0, 'Adjustment cannot be zero'),
      reason: z.string().trim().min(3).max(240),
      disputeId: z.string().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const result = await createAdjustment(req.user!, req.body);
    return created(res, result);
  }),
);
