import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, created, ok } from '../../core/http';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { loadMerchant } from '../merchants/middleware';
import { generateQr, listQrs, resolveQr, revokeQr } from './service';

export const qrRouter = Router();

// Merchant: create a new QR.
qrRouter.post(
  '/generate',
  requireAuth,
  requireRole('MERCHANT'),
  loadMerchant,
  validate({ body: z.object({ label: z.string().trim().max(60).optional() }) }),
  asyncHandler(async (req, res) => {
    const qr = await generateQr(req.merchantId!, req.body.label);
    return created(res, qr);
  }),
);

// Merchant: list own QRs.
qrRouter.get(
  '/',
  requireAuth,
  requireRole('MERCHANT'),
  loadMerchant,
  asyncHandler(async (req, res) => {
    const qrs = await listQrs(req.merchantId!);
    return ok(res, qrs);
  }),
);

// Merchant: revoke a QR.
qrRouter.post(
  '/:token/revoke',
  requireAuth,
  requireRole('MERCHANT'),
  loadMerchant,
  validate({ params: z.object({ token: z.string().min(1) }) }),
  asyncHandler(async (req, res) => {
    const qr = await revokeQr(req.merchantId!, req.params.token);
    return ok(res, qr);
  }),
);

// Customer: resolve a scanned QR to a shop card + own balance.
qrRouter.get(
  '/:token',
  requireAuth,
  requireRole('CUSTOMER'),
  validate({ params: z.object({ token: z.string().min(1) }) }),
  asyncHandler(async (req, res) => {
    const result = await resolveQr(req.params.token, req.user!.id);
    return ok(res, result);
  }),
);
