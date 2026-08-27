import { randomInt } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from '../../db/client';
import {
  identityVerifications,
  merchants,
  otpCodes,
  userProfiles,
  users,
} from '../../db/schema';
import type { UserRole } from '../../db/schema/enums';
import { CONFIG } from '../../core/config';
import { signToken } from '../../core/jwt';
import { BadRequestError, UnauthorizedError } from '../../core/errors';
import { logger } from '../../core/logger';

const OTP_MAX_ATTEMPTS = 5;

export async function sendOtp(mobile: string, role: UserRole) {
  const code = String(randomInt(100000, 1000000));
  const codeHash = bcrypt.hashSync(code, 8);
  const expiresAt = new Date(Date.now() + CONFIG.auth.otpTtlSeconds * 1000);

  await db.insert(otpCodes).values({ mobile, role, codeHash, expiresAt });

  logger.info(`OTP for ${mobile} (${role}): ${code} [dev only]`);

  return {
    sent: true,
    // In development we return the OTP so login works without a real SMS gateway.
    devOtp: CONFIG.auth.exposeOtpInResponse ? code : undefined,
    expiresInSeconds: CONFIG.auth.otpTtlSeconds,
  };
}

export async function verifyOtp(
  mobile: string,
  role: UserRole,
  code: string,
  name?: string,
) {
  const [otp] = await db
    .select()
    .from(otpCodes)
    .where(and(eq(otpCodes.mobile, mobile), eq(otpCodes.role, role), isNull(otpCodes.consumedAt)))
    .orderBy(desc(otpCodes.createdAt))
    .limit(1);

  if (!otp) throw new BadRequestError('No active OTP. Please request a new one.');
  if (otp.expiresAt.getTime() < Date.now()) {
    throw new BadRequestError('OTP expired. Please request a new one.');
  }
  if (otp.attempts >= OTP_MAX_ATTEMPTS) {
    throw new BadRequestError('Too many attempts. Please request a new OTP.');
  }

  const valid = bcrypt.compareSync(code, otp.codeHash);
  if (!valid) {
    await db.update(otpCodes).set({ attempts: otp.attempts + 1 }).where(eq(otpCodes.id, otp.id));
    throw new UnauthorizedError('Incorrect OTP');
  }

  await db.update(otpCodes).set({ consumedAt: new Date() }).where(eq(otpCodes.id, otp.id));

  // Find or create the user for this (mobile, role).
  let user = await db.query.users.findFirst({
    where: and(eq(users.mobile, mobile), eq(users.role, role)),
  });

  let isNew = false;
  if (!user) {
    isNew = true;
    user = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(users)
        .values({ mobile, role, name: name ?? null, mobileVerified: true })
        .returning();
      await tx.insert(userProfiles).values({ userId: created.id });
      await tx.insert(identityVerifications).values({ userId: created.id, status: 'UNVERIFIED' });
      return created;
    });
  } else {
    const patch: Record<string, unknown> = { mobileVerified: true, lastLoginAt: new Date() };
    if (name && !user.name) patch.name = name;
    await db.update(users).set(patch).where(eq(users.id, user.id));
    user = { ...user, ...patch } as typeof user;
  }

  const token = signToken({ sub: user.id, role: user.role, mobile: user.mobile });
  const me = await getMe(user.id);
  return { token, user: me, isNew };
}

export async function getMe(userId: string) {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) throw new UnauthorizedError('User not found');

  const [profile] = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1);

  const [identity] = await db
    .select()
    .from(identityVerifications)
    .where(eq(identityVerifications.userId, userId))
    .limit(1);

  let merchant = null;
  if (user.role === 'MERCHANT') {
    const [m] = await db.select().from(merchants).where(eq(merchants.ownerUserId, userId)).limit(1);
    merchant = m ?? null;
  }

  return {
    id: user.id,
    mobile: user.mobile,
    role: user.role,
    name: user.name,
    email: user.email,
    status: user.status,
    mobileVerified: user.mobileVerified,
    profile: profile
      ? {
          avatarUrl: profile.avatarUrl,
          address: profile.address,
          city: profile.city,
          state: profile.state,
          pincode: profile.pincode,
          language: profile.language,
          notificationPrefs: profile.notificationPrefs,
        }
      : null,
    identity: identity
      ? {
          status: identity.status,
          method: identity.method,
          maskedValue: identity.maskedValue,
          verifiedAt: identity.verifiedAt,
        }
      : { status: 'UNVERIFIED' as const },
    merchant: merchant
      ? { id: merchant.id, shopName: merchant.shopName, status: merchant.status }
      : null,
  };
}
