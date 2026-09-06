import { Router } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { asyncHandler, ok } from '../../core/http';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { authLimiter } from '../../middleware/rateLimit';
import { db } from '../../db/client';
import { userProfiles, users } from '../../db/schema';
import { LANGUAGES, USER_ROLES } from '../../db/schema/enums';
import { getMe, sendOtp, verifyOtp } from './service';

export const authRouter = Router();

const mobileSchema = z
  .string()
  .trim()
  .regex(/^\d{10}$/, 'Enter a valid 10-digit mobile number');

const roleSchema = z.enum(USER_ROLES);

authRouter.post(
  '/send-otp',
  authLimiter,
  validate({ body: z.object({ mobile: mobileSchema, role: roleSchema }) }),
  asyncHandler(async (req, res) => {
    const { mobile, role } = req.body;
    const result = await sendOtp(mobile, role);
    return ok(res, result);
  }),
);

authRouter.post(
  '/verify-otp',
  authLimiter,
  validate({
    body: z.object({
      mobile: mobileSchema,
      role: roleSchema,
      code: z.string().trim().regex(/^\d{6}$/, 'OTP must be 6 digits'),
      name: z.string().trim().min(1).max(80).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { mobile, role, code, name } = req.body;
    const result = await verifyOtp(mobile, role, code, name);
    return ok(res, result);
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const me = await getMe(req.user!.id);
    return ok(res, me);
  }),
);

authRouter.patch(
  '/profile',
  requireAuth,
  validate({
    body: z.object({
      name: z.string().trim().min(1).max(80).optional(),
      language: z.enum(LANGUAGES).optional(),
      address: z.string().trim().max(240).optional(),
      city: z.string().trim().max(80).optional(),
      state: z.string().trim().max(80).optional(),
      pincode: z.string().trim().regex(/^\d{6}$/).optional(),
      notificationPrefs: z.record(z.string(), z.boolean()).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const { name, ...profilePatch } = req.body;

    if (name) {
      await db.update(users).set({ name }).where(eq(users.id, userId));
    }
    if (Object.keys(profilePatch).length > 0) {
      await db
        .update(userProfiles)
        .set({ ...profilePatch, updatedAt: new Date() })
        .where(eq(userProfiles.userId, userId));
    }

    const me = await getMe(userId);
    return ok(res, me);
  }),
);
