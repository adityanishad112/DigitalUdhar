import type { NextFunction, Request, Response } from 'express';
import { ForbiddenError } from '../../core/errors';
import { resolveMerchantId } from './service';

/**
 * Attaches req.merchantId for MERCHANT owners and their STAFF. Reject if the
 * caller isn't tied to a shop. Run after authenticate + requireAuth.
 */
export async function loadMerchant(req: Request, _res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    const merchantId = await resolveMerchantId(user.id, user.role);
    if (!merchantId) {
      return next(new ForbiddenError('No shop is associated with this account'));
    }
    req.merchantId = merchantId;
    next();
  } catch (err) {
    next(err);
  }
}
