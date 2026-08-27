import { and, desc, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import {
  ledgerAccounts,
  merchantCustomers,
  merchantStaff,
  merchants,
  qrCodes,
  users,
} from '../../db/schema';
import type { UserRole } from '../../db/schema/enums';
import { ConflictError, ForbiddenError, NotFoundError } from '../../core/errors';
import { secureToken } from '../../core/ids';

export type Merchant = typeof merchants.$inferSelect;

export interface RegisterMerchantInput {
  shopName: string;
  legalName?: string;
  category?: string;
  description?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  phone?: string;
  email?: string;
  upiId?: string;
  gstin?: string;
}

export async function registerMerchant(ownerUserId: string, input: RegisterMerchantInput) {
  const existing = await db
    .select()
    .from(merchants)
    .where(eq(merchants.ownerUserId, ownerUserId))
    .limit(1);
  if (existing[0]) throw new ConflictError('You already have a shop registered');

  return db.transaction(async (tx) => {
    const [merchant] = await tx
      .insert(merchants)
      .values({ ownerUserId, ...input })
      .returning();

    // Every shop gets a primary counter QR out of the box.
    await tx.insert(qrCodes).values({
      merchantId: merchant.id,
      token: secureToken(18),
      label: 'Counter QR',
    });

    return merchant;
  });
}

export async function getMerchantByOwner(ownerUserId: string): Promise<Merchant | null> {
  const [m] = await db.select().from(merchants).where(eq(merchants.ownerUserId, ownerUserId)).limit(1);
  return m ?? null;
}

export async function getMerchantById(id: string): Promise<Merchant | null> {
  const [m] = await db.select().from(merchants).where(eq(merchants.id, id)).limit(1);
  return m ?? null;
}

/** Resolve which merchant a user acts for: owner directly, or staff via mapping. */
export async function resolveMerchantId(userId: string, role: UserRole): Promise<string | null> {
  if (role === 'MERCHANT') {
    const m = await getMerchantByOwner(userId);
    return m?.id ?? null;
  }
  if (role === 'STAFF') {
    const [s] = await db
      .select()
      .from(merchantStaff)
      .where(and(eq(merchantStaff.userId, userId), eq(merchantStaff.status, 'ACTIVE')))
      .limit(1);
    return s?.merchantId ?? null;
  }
  return null;
}

export async function updateMerchant(merchantId: string, patch: Record<string, unknown>) {
  const [updated] = await db
    .update(merchants)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(merchants.id, merchantId))
    .returning();
  if (!updated) throw new NotFoundError('Shop not found');
  return updated;
}

/** Public-facing shop card (safe to show any authenticated user after a scan). */
export function toPublicMerchant(m: Merchant) {
  return {
    id: m.id,
    shopName: m.shopName,
    category: m.category,
    description: m.description,
    city: m.city,
    state: m.state,
    upiId: m.upiId,
    status: m.status,
    defaultCreditLimitPaise: m.defaultCreditLimitPaise,
    defaultTermsDays: m.defaultTermsDays,
    defaultMaxTxnPaise: m.defaultMaxTxnPaise,
  };
}

/**
 * Merchant dashboard: every customer relationship with its live outstanding.
 * A merchant sees ONLY its own khatas — never another shop's data.
 */
export async function listMerchantCustomers(merchantId: string) {
  const rows = await db
    .select({
      relationship: merchantCustomers,
      account: ledgerAccounts,
      customer: {
        id: users.id,
        name: users.name,
        mobile: users.mobile,
      },
    })
    .from(merchantCustomers)
    .innerJoin(users, eq(users.id, merchantCustomers.customerUserId))
    .leftJoin(
      ledgerAccounts,
      and(
        eq(ledgerAccounts.merchantId, merchantCustomers.merchantId),
        eq(ledgerAccounts.customerUserId, merchantCustomers.customerUserId),
      ),
    )
    .where(eq(merchantCustomers.merchantId, merchantId))
    .orderBy(desc(merchantCustomers.updatedAt));

  return rows.map((r) => ({
    customerUserId: r.customer.id,
    name: r.relationship.displayName ?? r.customer.name,
    mobile: r.customer.mobile,
    creditLimitPaise: r.relationship.creditLimitPaise,
    termsDays: r.relationship.termsDays,
    status: r.relationship.status,
    outstandingPaise: r.account?.balancePaise ?? 0,
    totalUdhaarPaise: r.account?.totalUdhaarPaise ?? 0,
    totalRepaidPaise: r.account?.totalRepaidPaise ?? 0,
  }));
}

/**
 * Get or create the (merchant, customer) relationship, seeding limits from the
 * shop defaults. This is where per-customer credit terms live.
 */
export async function getOrCreateRelationship(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  merchantId: string,
  customerUserId: string,
) {
  const [existing] = await tx
    .select()
    .from(merchantCustomers)
    .where(
      and(
        eq(merchantCustomers.merchantId, merchantId),
        eq(merchantCustomers.customerUserId, customerUserId),
      ),
    )
    .limit(1);
  if (existing) return existing;

  const [merchant] = await tx.select().from(merchants).where(eq(merchants.id, merchantId)).limit(1);
  if (!merchant) throw new NotFoundError('Shop not found');
  if (merchant.status !== 'ACTIVE') throw new ForbiddenError('This shop is not accepting udhaar');

  const [created] = await tx
    .insert(merchantCustomers)
    .values({
      merchantId,
      customerUserId,
      creditLimitPaise: merchant.defaultCreditLimitPaise,
      termsDays: merchant.defaultTermsDays,
      maxTxnPaise: merchant.defaultMaxTxnPaise,
    })
    .returning();
  return created;
}
