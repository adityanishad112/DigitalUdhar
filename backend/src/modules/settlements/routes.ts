import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, ok } from '../../core/http';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { listSettlements, markSettled, summarizeSettlements } from './service';

export const settlementsRouter = Router();

// Merchant sees its own settlements; admin sees all.
settlementsRouter.get(
  '/',
  requireAuth,
  requireRole('MERCHANT', 'STAFF', 'ADMIN'),
  asyncHandler(async (req, res) => ok(res, await summarizeSettlements(req.user!))),
);

settlementsRouter.post(
  '/:id/settle',
  requireAuth,
  requireRole('ADMIN'),
  validate({ params: z.object({ id: z.string().min(1) }) }),
  asyncHandler(async (req, res) => ok(res, await markSettled(req.user!, req.params.id))),
);

void listSettlements;
