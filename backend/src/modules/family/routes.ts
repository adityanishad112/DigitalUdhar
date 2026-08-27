import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, created, ok } from '../../core/http';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { FAMILY_PERMISSIONS } from '../../db/schema/enums';
import {
  addFamilyMember,
  listFamily,
  removeFamilyMember,
  updateFamilyMember,
} from './service';

export const familyRouter = Router();

const mobileSchema = z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile');
const permsSchema = z.array(z.enum(FAMILY_PERMISSIONS)).min(1);

familyRouter.get(
  '/permissions',
  requireAuth,
  asyncHandler(async (req, res) => ok(res, await listFamily(req.user!.id))),
);

familyRouter.post(
  '/permissions',
  requireAuth,
  validate({
    body: z.object({
      memberMobile: mobileSchema,
      memberName: z.string().trim().max(80).optional(),
      permissions: permsSchema,
    }),
  }),
  asyncHandler(async (req, res) => created(res, await addFamilyMember(req.user!.id, req.body))),
);

familyRouter.patch(
  '/permissions/:id',
  requireAuth,
  validate({
    params: z.object({ id: z.string().min(1) }),
    body: z.object({
      permissions: permsSchema.optional(),
      status: z.enum(['ACTIVE', 'REVOKED']).optional(),
    }),
  }),
  asyncHandler(async (req, res) =>
    ok(res, await updateFamilyMember(req.user!.id, req.params.id, req.body)),
  ),
);

familyRouter.delete(
  '/permissions/:id',
  requireAuth,
  validate({ params: z.object({ id: z.string().min(1) }) }),
  asyncHandler(async (req, res) => ok(res, await removeFamilyMember(req.user!.id, req.params.id))),
);
