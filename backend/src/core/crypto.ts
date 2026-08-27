import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { CONFIG } from './config';

/**
 * AES-256-GCM encryption for sensitive identity data (Aadhaar/PAN).
 * Stored format: base64( iv(12) | authTag(16) | ciphertext ).
 * The key is a 32-byte value provided as 64 hex chars in IDENTITY_ENC_KEY.
 */
function encKey(): Buffer {
  const hex = CONFIG.identityEncKey;
  const key = Buffer.from(hex, 'hex');
  if (key.length !== 32) {
    // Derive a stable 32-byte key if a non-hex/short value was provided.
    return createHmac('sha256', 'digital-udhar-enc').update(hex).digest();
  }
  return key;
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encKey(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString('base64');
}

export function decrypt(payload: string): string {
  const raw = Buffer.from(payload, 'base64');
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const ct = raw.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', encKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}

/** HMAC-SHA256 hex, used for webhook signatures. */
export function hmacSha256(secret: string, payload: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

/** Constant-time comparison of two hex signatures. */
export function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/** Mask helpers — what merchants are allowed to see. Never the full number. */
export function maskAadhaar(aadhaar: string): string {
  const digits = aadhaar.replace(/\D/g, '');
  const last4 = digits.slice(-4);
  return `XXXX XXXX ${last4}`;
}

export function maskPan(pan: string): string {
  const p = pan.toUpperCase();
  if (p.length < 4) return 'XXXXXXXXXX';
  return `${'X'.repeat(p.length - 4)}${p.slice(-4)}`;
}
