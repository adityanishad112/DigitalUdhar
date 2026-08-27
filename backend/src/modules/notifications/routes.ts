import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, ok } from '../../core/http';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { listNotifications, markAllRead, markRead, unreadCount } from './service';

export const notificationsRouter = Router();

notificationsRouter.get(
  '/',
  requireAuth,
  validate({ query: z.object({ unread: z.coerce.boolean().optional() }) }),
  asyncHandler(async (req, res) =>
    ok(res, await listNotifications(req.user!.id, (req.query.unread as unknown) === true)),
  ),
);

notificationsRouter.get(
  '/unread-count',
  requireAuth,
  asyncHandler(async (req, res) => ok(res, { count: await unreadCount(req.user!.id) })),
);

notificationsRouter.post(
  '/:id/read',
  requireAuth,
  validate({ params: z.object({ id: z.string().min(1) }) }),
  asyncHandler(async (req, res) => {
    await markRead(req.user!.id, req.params.id);
    return ok(res, { ok: true });
  }),
);

notificationsRouter.post(
  '/read-all',
  requireAuth,
  asyncHandler(async (req, res) => {
    await markAllRead(req.user!.id);
    return ok(res, { ok: true });
  }),
);
