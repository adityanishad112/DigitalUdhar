import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, created, ok } from '../../core/http';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { loadMerchant } from '../merchants/middleware';
import {
  acceptUdhaar,
  createPromiseToPay,
  getUdhaarDetail,
  listUdhaarForCustomer,
  listUdhaarForMerchant,
  recordCashRepayment,
  rejectUdhaar,
  requestUdhaar,
} from './service';

export const udhaarRouter = Router();

const itemSchema = z.object({
  name: z.string().trim().min(1).max(120),
  qty: z.number().int().positive().max(100000).optional(),
  pricePaise: z.number().int().min(0).max(100_000_000).optional(),
});

// Customer takes udhaar → REQUESTED
udhaarRouter.post(
  '/request',
  requireAuth,
  requireRole('CUSTOMER'),
  validate({
    body: z.object({
      merchantId: z.string().min(1),
      principalPaise: z.number().int().positive().max(100_000_000),
      items: z.array(itemSchema).max(50).optional(),
      note: z.string().trim().max(400).optional(),
      billRef: z.string().trim().max(60).optional(),
      dueDate: z.coerce.date().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const row = await requestUdhaar(req.user!.id, req.body);
    return created(res, row);
  }),
);

// List: customer sees own khatas; merchant/staff see the shop's.
udhaarRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    if (user.role === 'CUSTOMER') {
      return ok(res, await listUdhaarForCustomer(user.id));
    }
    if (user.role === 'MERCHANT' || user.role === 'STAFF') {
      const { resolveMerchantId } = await import('../merchants/service');
      const merchantId = await resolveMerchantId(user.id, user.role);
      if (!merchantId) return ok(res, []);
      return ok(res, await listUdhaarForMerchant(merchantId));
    }
    return ok(res, []);
  }),
);

udhaarRouter.get(
  '/:id',
  requireAuth,
  validate({ params: z.object({ id: z.string().min(1) }) }),
  asyncHandler(async (req, res) => {
    const detail = await getUdhaarDetail(req.params.id, req.user!);
    return ok(res, detail);
  }),
);

udhaarRouter.post(
  '/:id/accept',
  requireAuth,
  requireRole('MERCHANT', 'STAFF'),
  loadMerchant,
  validate({ params: z.object({ id: z.string().min(1) }) }),
  asyncHandler(async (req, res) => {
    const result = await acceptUdhaar(req.merchantId!, req.params.id, req.user!.id, req.user!.role);
    return ok(res, result);
  }),
);

udhaarRouter.post(
  '/:id/reject',
  requireAuth,
  requireRole('MERCHANT', 'STAFF'),
  loadMerchant,
  validate({
    params: z.object({ id: z.string().min(1) }),
    body: z.object({ reason: z.string().trim().max(240).optional() }),
  }),
  asyncHandler(async (req, res) => {
    const row = await rejectUdhaar(
      req.merchantId!,
      req.params.id,
      req.body.reason,
      req.user!.id,
      req.user!.role,
    );
    return ok(res, row);
  }),
);

udhaarRouter.post(
  '/:id/promise-to-pay',
  requireAuth,
  requireRole('CUSTOMER'),
  validate({
    params: z.object({ id: z.string().min(1) }),
    body: z.object({
      promisedDate: z.coerce.date(),
      amountPaise: z.number().int().positive().max(100_000_000).optional(),
      note: z.string().trim().max(240).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const promise = await createPromiseToPay(
      req.user!.id,
      req.params.id,
      req.body.promisedDate,
      req.body.amountPaise,
      req.body.note,
    );
    return created(res, promise);
  }),
);

udhaarRouter.post(
  '/:id/cash-repayment',
  requireAuth,
  requireRole('MERCHANT', 'STAFF'),
  loadMerchant,
  validate({
    params: z.object({ id: z.string().min(1) }),
    body: z.object({ amountPaise: z.number().int().positive().max(100_000_000) }),
  }),
  asyncHandler(async (req, res) => {
    const result = await recordCashRepayment(
      req.merchantId!,
      req.params.id,
      req.body.amountPaise,
      req.user!.id,
      req.user!.role,
    );
    return ok(res, result);
  }),
);
