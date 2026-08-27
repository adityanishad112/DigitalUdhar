import 'dotenv/config';

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
}

function bool(name: string, fallback: boolean): boolean {
  const v = process.env[name];
  if (v === undefined) return fallback;
  return v === 'true' || v === '1' || v === 'yes';
}

function int(name: string, fallback: number): number {
  const v = process.env[name];
  if (v === undefined) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export const CONFIG = {
  env: process.env.NODE_ENV ?? 'development',
  isProd: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',
  port: int('PORT', 4000),

  // On Render (and similar PaaS) the public URL is injected as RENDER_EXTERNAL_URL.
  // Fall back to it so CORS allow-listing and QR deep-links are correct in a
  // single-service deploy without having to hard-code the URL by hand.
  appBaseUrl: process.env.APP_BASE_URL ?? process.env.RENDER_EXTERNAL_URL ?? 'http://localhost:5173',
  apiBaseUrl: process.env.API_BASE_URL ?? process.env.RENDER_EXTERNAL_URL ?? 'http://localhost:4000',

  db: {
    url: process.env.DATABASE_URL ?? '',
    pgliteDir: process.env.PGLITE_DATA_DIR ?? './.data/udhar',
  },

  auth: {
    jwtSecret: required('JWT_SECRET', 'dev-insecure-secret-change-me'),
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
    otpTtlSeconds: int('OTP_TTL_SECONDS', 300),
    exposeOtpInResponse: bool('EXPOSE_OTP_IN_RESPONSE', true),
  },

  gateway: {
    provider: process.env.PAYMENT_GATEWAY_PROVIDER ?? 'mock',
    keyId: process.env.PAYMENT_GATEWAY_KEY_ID ?? 'mock_key_id',
    keySecret: process.env.PAYMENT_GATEWAY_KEY_SECRET ?? 'mock_key_secret',
    webhookSecret: process.env.PAYMENT_GATEWAY_WEBHOOK_SECRET ?? 'mock_webhook_secret',
    feePercent: int('GATEWAY_FEE_PERCENT', 2),
  },

  identityEncKey: required('IDENTITY_ENC_KEY', '0'.repeat(64)),

  autoSeed: bool('AUTO_SEED', true),
} as const;

export type AppConfig = typeof CONFIG;
