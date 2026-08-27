import rateLimit from 'express-rate-limit';
import { CONFIG } from '../core/config';

const disabled = CONFIG.isTest;

/** Generic API limiter. */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: disabled ? 100000 : 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { ok: false, error: { code: 'RATE_LIMITED', message: 'Too many requests' } },
});

/** Tight limiter for OTP / auth endpoints to slow down abuse. */
export const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: disabled ? 100000 : 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    ok: false,
    error: { code: 'RATE_LIMITED', message: 'Too many attempts. Try again later.' },
  },
});
