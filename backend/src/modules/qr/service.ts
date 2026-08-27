import { and, desc, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { ledgerAccounts, merchantCustomers, merchants, qrCodes } from '../../db/schema';
import { ForbiddenError, NotFoundError } from '../../core/errors';
import { secureToken } from '../../core/ids';
import { CONFIG } from '../../core/config';
import { toPublicMerchant } from '../merchants/service';

export type QrCode = typeof qrCodes.$inferSelect;

/** The string encoded into the QR image. A deep link so any camera can open it. */
export function qrPayload(token: string): string {
  return `${CONFIG.appBaseUrl}/s/${token}`;
}

export async function generateQr(merchantId: string, label?: string) {
  const [qr] = await db
    .insert(qrCodes)
    .values({ merchantId, token: secureToken(18), label: label ?? 'Shop QR' })
    .returning();
  return { ...qr, payload: qrPayload(qr.token) };
}

export async function listQrs(merchantId: string) {
  const rows = await db
    .select()
    .from(qrCodes)
    .where(eq(qrCodes.merchantId, merchantId))
    .orderBy(desc(qrCodes.createdAt));
  return rows.map((q) => ({ ...q, payload: qrPayload(q.token) }));
}

export async function revokeQr(merchantId: string, token: string) {
  const [qr] = await db.select().from(qrCodes).where(eq(qrCodes.token, token)).limit(1);
  if (!qr) throw new NotFoundError('QR not found');
  if (qr.merchantId !== merchantId) throw new ForbiddenError('This QR belongs to another shop');

  const [updated] = await db
    .update(qrCodes)
    .set({ status: 'REVOKED', revokedAt: new Date(), updatedAt: new Date() })
    .where(eq(qrCodes.id, qr.id))
    .returning();
  return updated;
}

/**
 * Resolve a scanned token to the shop card, plus the scanning customer's OWN
 * running balance at that shop (privacy: never another customer's data).
 */
export async function resolveQr(token: string, customerUserId: string) {
  const [qr] = await db.select().from(qrCodes).where(eq(qrCodes.token, token)).limit(1);
  if (!qr) throw new NotFoundError('This QR is not recognised');
  if (qr.status !== 'ACTIVE') throw new ForbiddenError('This QR has been revoked');

  const [merchant] = await db.select().from(merchants).where(eq(merchants.id, qr.merchantId)).limit(1);
  if (!merchant) throw new NotFoundError('Shop not found');

  const [account] = await db
    .select()
    .from(ledgerAccounts)
    .where(
      and(
        eq(ledgerAccounts.merchantId, merchant.id),
        eq(ledgerAccounts.customerUserId, customerUserId),
      ),
    )
    .limit(1);

  const [relationship] = await db
    .select()
    .from(merchantCustomers)
    .where(
      and(
        eq(merchantCustomers.merchantId, merchant.id),
        eq(merchantCustomers.customerUserId, customerUserId),
      ),
    )
    .limit(1);

  return {
    qr: { id: qr.id, token: qr.token, label: qr.label },
    merchant: toPublicMerchant(merchant),
    myAccount: {
      outstandingPaise: account?.balancePaise ?? 0,
      creditLimitPaise: relationship?.creditLimitPaise ?? merchant.defaultCreditLimitPaise,
      termsDays: relationship?.termsDays ?? merchant.defaultTermsDays,
      hasRelationship: Boolean(relationship),
      relationshipStatus: relationship?.status ?? null,
    },
  };
}
