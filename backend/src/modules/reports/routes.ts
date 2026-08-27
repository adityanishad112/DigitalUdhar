import { Router } from 'express';
import { asyncHandler, ok } from '../../core/http';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { loadMerchant } from '../merchants/middleware';
import { getMerchantActivity, getMerchantReport } from './service';

export const reportsRouter = Router();

// Merchant (or its staff) analytics — deterministic aggregation, no AI.
reportsRouter.get(
  '/',
  requireAuth,
  requireRole('MERCHANT', 'STAFF'),
  loadMerchant,
  asyncHandler(async (req, res) => ok(res, await getMerchantReport(req.merchantId!))),
);

reportsRouter.get(
  '/activity',
  requireAuth,
  requireRole('MERCHANT', 'STAFF'),
  loadMerchant,
  asyncHandler(async (req, res) => ok(res, await getMerchantActivity(req.merchantId!))),
);
