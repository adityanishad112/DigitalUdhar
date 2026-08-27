import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { identityVerifications } from '../../db/schema';
import type { IdentityMethod, UserRole } from '../../db/schema/enums';
import { BadRequestError } from '../../core/errors';
import { encrypt, maskAadhaar, maskPan } from '../../core/crypto';
import { secureToken } from '../../core/ids';
import { writeAudit } from '../audit/service';

/** Validate the raw government id per method. */
function validateIdValue(method: IdentityMethod, value: string): string {
  const v = value.replace(/\s+/g, '').toUpperCase();
  if (method === 'AADHAAR') {
    if (!/^\d{12}$/.test(v)) throw new BadRequestError('Aadhaar must be 12 digits');
  } else if (method === 'PAN') {
    if (!/^[A-Z]{5}\d{4}[A-Z]$/.test(v)) throw new BadRequestError('Enter a valid PAN (ABCDE1234F)');
  } else if (method === 'DL' || method === 'PASSPORT') {
    if (v.length < 6 || v.length > 20) throw new BadRequestError('Enter a valid document number');
  }
  return v;
}

function maskFor(method: IdentityMethod, value: string): string {
  if (method === 'AADHAAR') return maskAadhaar(value);
  if (method === 'PAN') return maskPan(value);
  return `${'X'.repeat(Math.max(0, value.length - 4))}${value.slice(-4)}`;
}

/**
 * Submit an identity for verification. The FULL value is encrypted at rest and
 * NEVER returned to anyone (only a masked value is stored for display to the
 * owner). Requires explicit consent. In this build the provider is mocked and
 * returns VERIFIED immediately; the storage/consent/masking contract is real.
 */
export async function submitIdentity(
  actor: { id: string; role: UserRole },
  method: IdentityMethod,
  value: string,
  consent: boolean,
) {
  if (!consent) throw new BadRequestError('Consent is required to verify your identity');

  const clean = validateIdValue(method, value);
  const encryptedData = encrypt(clean);
  const maskedValue = maskFor(method, clean);
  const reference = `mock_${secureToken(8)}`;
  const now = new Date();

  const [existing] = await db
    .select()
    .from(identityVerifications)
    .where(eq(identityVerifications.userId, actor.id))
    .limit(1);

  const values = {
    status: 'VERIFIED' as const,
    method,
    provider: 'mock',
    reference,
    encryptedData,
    maskedValue,
    consentGiven: true,
    consentAt: now,
    verifiedAt: now,
    updatedAt: now,
  };

  if (existing) {
    await db.update(identityVerifications).set(values).where(eq(identityVerifications.userId, actor.id));
  } else {
    await db.insert(identityVerifications).values({ userId: actor.id, ...values });
  }

  await writeAudit(db, {
    actorUserId: actor.id,
    actorRole: actor.role,
    action: 'IDENTITY_SUBMITTED',
    entityType: 'identity',
    entityId: actor.id,
    summary: `Identity (${method}) submitted and verified`,
    metadata: { method, maskedValue },
  });

  // Return the masked view only — never the raw value.
  return { status: values.status, method, maskedValue, verifiedAt: now, consentGiven: true };
}

export async function getMyIdentity(userId: string) {
  const [row] = await db
    .select()
    .from(identityVerifications)
    .where(eq(identityVerifications.userId, userId))
    .limit(1);
  if (!row) return { status: 'UNVERIFIED' as const };
  return {
    status: row.status,
    method: row.method,
    maskedValue: row.maskedValue,
    verifiedAt: row.verifiedAt,
    consentGiven: row.consentGiven,
  };
}

/** For merchants/admin: ONLY a verification badge, never the id itself. */
export async function getVerificationBadge(userId: string) {
  const [row] = await db
    .select({ status: identityVerifications.status, method: identityVerifications.method })
    .from(identityVerifications)
    .where(eq(identityVerifications.userId, userId))
    .limit(1);
  return { verified: row?.status === 'VERIFIED', method: row?.method ?? null };
}
