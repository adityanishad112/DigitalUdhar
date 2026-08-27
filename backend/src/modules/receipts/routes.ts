import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, ok } from '../../core/http';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { ForbiddenError, NotFoundError } from '../../core/errors';
import { getReceipt, listReceiptsForUdhaar } from './service';
import { resolveMerchantId } from '../merchants/service';

export const receiptsRouter = Router();

async function assertCanView(
  receipt: { customerUserId: string; merchantId: string },
  requester: { id: string; role: string },
) {
  if (requester.role === 'ADMIN') return;
  if (requester.role === 'CUSTOMER' && receipt.customerUserId === requester.id) return;
  if (requester.role === 'MERCHANT' || requester.role === 'STAFF') {
    const mid = await resolveMerchantId(requester.id, requester.role as never);
    if (mid === receipt.merchantId) return;
  }
  throw new ForbiddenError('You cannot view this receipt');
}

// Fetch a single immutable receipt by its human receipt number.
receiptsRouter.get(
  '/:receiptNo',
  requireAuth,
  validate({ params: z.object({ receiptNo: z.string().min(1) }) }),
  asyncHandler(async (req, res) => {
    const receipt = await getReceipt(req.params.receiptNo);
    if (!receipt) throw new NotFoundError('Receipt not found');
    await assertCanView(receipt, req.user!);
    return ok(res, receipt);
  }),
);

// All receipts for one udhaar (authorised via the first receipt found).
receiptsRouter.get(
  '/udhaar/:udhaarId',
  requireAuth,
  validate({ params: z.object({ udhaarId: z.string().min(1) }) }),
  asyncHandler(async (req, res) => {
    const list = await listReceiptsForUdhaar(req.params.udhaarId);
    if (list.length) await assertCanView(list[0], req.user!);
    return ok(res, list);
  }),
);
