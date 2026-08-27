import jwt from 'jsonwebtoken';
import { CONFIG } from './config';
import type { UserRole } from '../db/schema/enums';

export interface JwtPayload {
  sub: string; // user id
  role: UserRole;
  mobile: string;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, CONFIG.auth.jwtSecret, {
    expiresIn: CONFIG.auth.jwtExpiresIn as jwt.SignOptions['expiresIn'],
  });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, CONFIG.auth.jwtSecret) as JwtPayload;
}
