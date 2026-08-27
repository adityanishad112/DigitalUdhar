import type { NextFunction, Request, Response } from 'express';
import { ForbiddenError, UnauthorizedError } from '../core/errors';
import type { UserRole } from '../db/schema/enums';

/** Restrict a route to one or more roles. Assumes authenticate ran first. */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new UnauthorizedError());
    if (!roles.includes(req.user.role)) {
      return next(new ForbiddenError('Your role cannot perform this action'));
    }
    next();
  };
}
