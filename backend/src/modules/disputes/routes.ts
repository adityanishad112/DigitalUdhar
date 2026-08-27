import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, created, ok } from '../../core/http';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { DISPUTE_CATEGORIES } from '../../db/schema/enums';
import {
  addEvidence,
  getDispute,
  listDisputes,
  raiseDispute,
  resolveDispute,
} from './service';

export const disputesRouter = Router();

// A participant (customer or the shop) raises a dispute on an udhaar.
disputesRouter.post(
  '/',
  requireAuth,
  validate({
    body: z.object({
      udhaarId: z.string().min(1),
      category: z.enum(DISPUTE_CATEGORIES),
      description: z.string().trim().max(1000).optional(),
      amountClaimedPaise: z.number().int().positive().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const dispute = await raiseDispute(req.user!, req.body);
    return created(res, dispute);
  }),
);

disputesRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => ok(res, await listDisputes(req.user!))),
);

disputesRouter.get(
  '/:id',
  requireAuth,
  validate({ params: z.object({ id: z.string().min(1) }) }),
  asyncHandler(async (req, res) => ok(res, await getDispute(req.params.id, req.user!))),
);

disputesRouter.post(
  '/:id/evidence',
  requireAuth,
  validate({
    params: z.object({ id: z.string().min(1) }),
    body: z.object({ text: z.string().trim().min(1).max(1000) }),
  }),
  asyncHandler(async (req, res) => {
    const evidence = await addEvidence(req.user!, req.params.id, req.body.text);
    return created(res, evidence);
  }),
);

// Only the shop that owns it, or an admin, can resolve — optionally with a balance correction.
disputesRouter.post(
  '/:id/resolve',
  requireAuth,
  requireRole('MERCHANT', 'ADMIN'),
  validate({
    params: z.object({ id: z.string().min(1) }),
    body: z.object({
      status: z.enum(['RESOLVED', 'REJECTED']),
      resolution: z.string().trim().min(3).max(1000),
      adjustmentPaise: z.number().int().optional(),
      adjustmentReason: z.string().trim().max(240).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const dispute = await resolveDispute(req.user!, req.params.id, req.body);
    return ok(res, dispute);
  }),
);
