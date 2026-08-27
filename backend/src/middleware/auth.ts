import type { NextFunction, Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { users } from '../db/schema';
import { verifyToken } from '../core/jwt';
import { ForbiddenError, UnauthorizedError } from '../core/errors';

/**
 * Parse the Bearer token if present, load the fresh user record (so account
 * freezes/suspensions take effect immediately), and attach req.user.
 * Does not reject when the header is absent — use requireAuth for that.
 */
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) return next();

    const token = header.slice('Bearer '.length).trim();
    const payload = verifyToken(token);

    const row = await db.query.users.findFirst({ where: eq(users.id, payload.sub) });
    if (!row) throw new UnauthorizedError('Session no longer valid');
    if (row.status === 'SUSPENDED') throw new ForbiddenError('This account is suspended');
    if (row.status === 'FROZEN') {
      throw new ForbiddenError('This account is frozen. Contact support.');
    }

    req.user = { id: row.id, role: row.role, mobile: row.mobile };
    next();
  } catch (err) {
    if (err instanceof UnauthorizedError || err instanceof ForbiddenError) return next(err);
    next(new UnauthorizedError('Invalid or expired session'));
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(new UnauthorizedError());
  next();
}
