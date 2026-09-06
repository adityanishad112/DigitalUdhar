import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, created, ok } from '../../core/http';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { PAYMENT_METHODS } from '../../db/schema/enums';
import {
  createOrder,
  getPayment,
  processWebhook,
  refundPayment,
  simulatePayment,
  verifyPayment,
} from './service';

export const paymentsRouter = Router();

// Customer creates a repayment order.
paymentsRouter.post(
  '/create-order',
  requireAuth,
  requireRole('CUSTOMER'),
  validate({
    body: z.object({
      udhaarId: z.string().min(1),
      amountPaise: z.number().int().positive().max(100_000_000),
      method: z.enum(PAYMENT_METHODS).optional(),
      idempotencyKey: z.string().trim().min(6).max(120).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const result = await createOrder(req.user!.id, req.body);
    return created(res, result);
  }),
);

// Customer verifies client-side checkout completion with the signed gateway response.
paymentsRouter.post(
  '/verify',
  requireAuth,
  requireRole('CUSTOMER'),
  validate({
    body: z.object({
      gatewayOrderId: z.string().min(1),
      gatewayPaymentId: z.string().min(1),
      signature: z.string().min(1),
    }),
  }),
  asyncHandler(async (req, res) => {
    const result = await verifyPayment(req.user!.id, req.body);
    return ok(res, result);
  }),
);

/**
 * Gateway webhook. UNAUTHENTICATED — trust comes solely from the HMAC signature
 * over the raw body. Verified + idempotent inside processWebhook. Always answer
 * 200 for a handled event so the gateway stops retrying; 401 only on bad signature.
 */
paymentsRouter.post(
  '/webhook',
  asyncHandler(async (req, res) => {
    const signature =
      (req.headers['x-razorpay-signature'] as string) ??
      (req.headers['x-webhook-signature'] as string) ??
      '';
    const eventId = (req.headers['x-razorpay-event-id'] as string) ?? undefined;
    const rawBody = (req as unknown as { rawBody?: string }).rawBody ?? JSON.stringify(req.body ?? {});
    const result = await processWebhook(rawBody, signature, eventId);
    return ok(res, result);
  }),
);

// Mock checkout: simulate success/failure; this triggers the signed webhook.
paymentsRouter.post(
  '/mock/pay',
  requireAuth,
  requireRole('CUSTOMER'),
  validate({
    body: z.object({
      gatewayOrderId: z.string().min(1),
      outcome: z.enum(['success', 'fail']).default('success'),
    }),
  }),
  asyncHandler(async (req, res) => {
    const result = await simulatePayment(req.user!.id, req.body.gatewayOrderId, req.body.outcome);
    return ok(res, result);
  }),
);

paymentsRouter.get(
  '/:id',
  requireAuth,
  validate({ params: z.object({ id: z.string().min(1) }) }),
  asyncHandler(async (req, res) => {
    const result = await getPayment(req.params.id, req.user!);
    return ok(res, result);
  }),
);

// Refund (merchant who received it, or admin).
paymentsRouter.post(
  '/:id/refund',
  requireAuth,
  requireRole('MERCHANT', 'ADMIN'),
  validate({
    params: z.object({ id: z.string().min(1) }),
    body: z.object({
      amountPaise: z.number().int().positive().max(100_000_000),
      reason: z.string().trim().max(240).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const result = await refundPayment(req.user!, req.params.id, req.body.amountPaise, req.body.reason);
    return ok(res, result);
  }),
);
