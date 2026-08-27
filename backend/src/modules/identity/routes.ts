import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, ok } from '../../core/http';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { IDENTITY_METHODS } from '../../db/schema/enums';
import { getMyIdentity, submitIdentity } from './service';

export const identityRouter = Router();

identityRouter.post(
  '/submit',
  requireAuth,
  validate({
    body: z.object({
      method: z.enum(IDENTITY_METHODS),
      value: z.string().trim().min(4).max(40),
      consent: z.boolean(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const result = await submitIdentity(req.user!, req.body.method, req.body.value, req.body.consent);
    return ok(res, result);
  }),
);

identityRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    return ok(res, await getMyIdentity(req.user!.id));
  }),
);
