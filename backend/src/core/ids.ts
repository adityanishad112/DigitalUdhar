import { randomUUID, randomBytes } from 'node:crypto';

/** Primary keys are application-generated UUIDv4. */
export function newId(): string {
  return randomUUID();
}

/** URL-safe opaque token (e.g. QR merchant token). Not guessable. */
export function secureToken(bytes = 24): string {
  return randomBytes(bytes).toString('base64url');
}

/** Short uppercase alphanumeric suffix for human-facing references. */
export function shortCode(len = 8): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no ambiguous chars
  const bytes = randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

function yyyymmdd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

/** Udhaar reference: UDR-YYYYMMDD-000123 (sequence is per-day, from the DB). */
export function formatUdhaarRef(seq: number, date = new Date()): string {
  return `UDR-${yyyymmdd(date)}-${String(seq).padStart(6, '0')}`;
}

/** Payment reference: PAY-XXXXXXXX */
export function formatPaymentRef(): string {
  return `PAY-${shortCode(8)}`;
}

/** Receipt number: RCP-YYYYMMDD-XXXXXX */
export function formatReceiptNo(date = new Date()): string {
  return `RCP-${yyyymmdd(date)}-${shortCode(6)}`;
}

/** Gateway-style order / payment ids for the mock provider. */
export function mockGatewayOrderId(): string {
  return `order_${randomBytes(10).toString('hex')}`;
}
export function mockGatewayPaymentId(): string {
  return `pay_${randomBytes(10).toString('hex')}`;
}
export function mockGatewayRefundId(): string {
  return `rfnd_${randomBytes(10).toString('hex')}`;
}
export function webhookEventId(): string {
  return `evt_${randomBytes(12).toString('hex')}`;
}
