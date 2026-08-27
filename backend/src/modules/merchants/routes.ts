import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, created, ok } from '../../core/http';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { NotFoundError } from '../../core/errors';
import { writeAudit } from '../audit/service';
import { db } from '../../db/client';
import { loadMerchant } from './middleware';
import {
  getMerchantByOwner,
  getMerchantById,
  listMerchantCustomers,
  registerMerchant,
  toPublicMerchant,
  updateMerchant,
} from './service';

export const merchantsRouter = Router();

const shopBody = {
  shopName: z.string().trim().min(2).max(120),
  legalName: z.string().trim().max(160).optional(),
  category: z.string().trim().max(60).optional(),
  description: z.string().trim().max(400).optional(),
  address: z.string().trim().max(240).optional(),
  city: z.string().trim().max(80).optional(),
  state: z.string().trim().max(80).optional(),
  pincode: z.string().trim().regex(/^\d{6}$/).optional(),
  phone: z.string().trim().max(15).optional(),
  email: z.string().trim().email().max(160).optional(),
  upiId: z.string().trim().max(120).optional(),
  gstin: z.string().trim().max(20).optional(),
};

// Register a shop (merchant onboarding).
merchantsRouter.post(
  '/',
  requireAuth,
  requireRole('MERCHANT'),
  validate({ body: z.object(shopBody) }),
  asyncHandler(async (req, res) => {
    const merchant = await registerMerchant(req.user!.id, req.body);
    await writeAudit(db, {
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
      action: 'MERCHANT_REGISTERED',
      entityType: 'merchant',
      entityId: merchant.id,
      summary: `Registered shop ${merchant.shopName}`,
      ip: req.ip,
    });
    return created(res, merchant);
  }),
);

// Own shop profile.
merchantsRouter.get(
  '/me',
  requireAuth,
  requireRole('MERCHANT'),
  asyncHandler(async (req, res) => {
    const merchant = await getMerchantByOwner(req.user!.id);
    if (!merchant) throw new NotFoundError('No shop registered yet');
    return ok(res, merchant);
  }),
);

const updatableBody = {
  ...shopBody,
  shopName: z.string().trim().min(2).max(120).optional(),
  defaultCreditLimitPaise: z.number().int().min(0).max(100_000_000).optional(),
  defaultTermsDays: z.number().int().min(1).max(365).optional(),
  defaultMaxTxnPaise: z.number().int().min(0).max(100_000_000).optional(),
};

merchantsRouter.patch(
  '/me',
  requireAuth,
  requireRole('MERCHANT'),
  loadMerchant,
  validate({ body: z.object(updatableBody) }),
  asyncHandler(async (req, res) => {
    const merchant = await updateMerchant(req.merchantId!, req.body);
    return ok(res, merchant);
  }),
);

// Merchant dashboard: all customers + live outstanding (owner or staff).
merchantsRouter.get(
  '/me/customers',
  requireAuth,
  requireRole('MERCHANT', 'STAFF'),
  loadMerchant,
  asyncHandler(async (req, res) => {
    const customers = await listMerchantCustomers(req.merchantId!);
    return ok(res, customers);
  }),
);

// Public shop card by id (any authenticated user; safe subset only).
merchantsRouter.get(
  '/:id/public',
  requireAuth,
  validate({ params: z.object({ id: z.string().min(1) }) }),
  asyncHandler(async (req, res) => {
    const merchant = await getMerchantById(req.params.id);
    if (!merchant) throw new NotFoundError('Shop not found');
    return ok(res, toPublicMerchant(merchant));
  }),
);
