import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, ok } from '../../core/http';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { MERCHANT_STATUSES, USER_ROLES, USER_STATUSES } from '../../db/schema/enums';
import { listAuditForEntity, listAuditLogs } from '../audit/service';
import {
  getOverview,
  listMerchants,
  listUsers,
  setMerchantStatus,
  setUserStatus,
} from './service';

export const adminRouter = Router();

// Everything here is admin-only.
adminRouter.use(requireAuth, requireRole('ADMIN'));

adminRouter.get(
  '/overview',
  asyncHandler(async (_req, res) => ok(res, await getOverview())),
);

adminRouter.get(
  '/users',
  validate({
    query: z.object({
      role: z.enum(USER_ROLES).optional(),
      status: z.enum(USER_STATUSES).optional(),
      q: z.string().trim().max(40).optional(),
    }),
  }),
  asyncHandler(async (req, res) => ok(res, await listUsers(req.query as never))),
);

adminRouter.post(
  '/users/:id/status',
  validate({
    params: z.object({ id: z.string().min(1) }),
    body: z.object({
      status: z.enum(USER_STATUSES),
      reason: z.string().trim().max(240).optional(),
    }),
  }),
  asyncHandler(async (req, res) =>
    ok(res, await setUserStatus(req.user!, req.params.id, req.body.status, req.body.reason)),
  ),
);

adminRouter.get(
  '/merchants',
  validate({ query: z.object({ status: z.enum(MERCHANT_STATUSES).optional() }) }),
  asyncHandler(async (req, res) => ok(res, await listMerchants(req.query as never))),
);

adminRouter.post(
  '/merchants/:id/status',
  validate({
    params: z.object({ id: z.string().min(1) }),
    body: z.object({
      status: z.enum(MERCHANT_STATUSES),
      reason: z.string().trim().max(240).optional(),
    }),
  }),
  asyncHandler(async (req, res) =>
    ok(res, await setMerchantStatus(req.user!, req.params.id, req.body.status, req.body.reason)),
  ),
);

adminRouter.get(
  '/audit-logs',
  validate({
    query: z.object({
      entityType: z.string().optional(),
      entityId: z.string().optional(),
      limit: z.coerce.number().int().min(1).max(500).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    if (req.query.entityType && req.query.entityId) {
      return ok(res, await listAuditForEntity(String(req.query.entityType), String(req.query.entityId)));
    }
    return ok(res, await listAuditLogs(req.query.limit ? Number(req.query.limit) : undefined));
  }),
);
