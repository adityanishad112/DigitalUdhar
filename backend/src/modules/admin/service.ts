import { and, desc, eq, like, or } from 'drizzle-orm';
import { db } from '../../db/client';
import {
  auditLogs,
  disputes,
  ledgerAccounts,
  merchants,
  payments,
  udhaar,
  users,
} from '../../db/schema';
import type { MerchantStatus, UserRole, UserStatus } from '../../db/schema/enums';
import { BadRequestError, NotFoundError } from '../../core/errors';
import { writeAudit } from '../audit/service';

/** Platform-wide overview for the admin dashboard. All money in paise. */
export async function getOverview() {
  const allUsers = await db.select({ id: users.id, role: users.role, status: users.status }).from(users);
  const usersByRole: Record<string, number> = { CUSTOMER: 0, MERCHANT: 0, STAFF: 0, ADMIN: 0 };
  let frozenOrSuspended = 0;
  for (const u of allUsers) {
    usersByRole[u.role] = (usersByRole[u.role] ?? 0) + 1;
    if (u.status !== 'ACTIVE') frozenOrSuspended += 1;
  }

  const allMerchants = await db.select({ id: merchants.id, status: merchants.status }).from(merchants);
  const merchantsByStatus: Record<string, number> = { PENDING: 0, ACTIVE: 0, SUSPENDED: 0 };
  for (const m of allMerchants) merchantsByStatus[m.status] = (merchantsByStatus[m.status] ?? 0) + 1;

  const accounts = await db
    .select({ balancePaise: ledgerAccounts.balancePaise, totalUdhaarPaise: ledgerAccounts.totalUdhaarPaise, totalRepaidPaise: ledgerAccounts.totalRepaidPaise })
    .from(ledgerAccounts);
  const totalOutstandingPaise = accounts.reduce((s, a) => s + a.balancePaise, 0);
  const totalUdhaarVolumePaise = accounts.reduce((s, a) => s + a.totalUdhaarPaise, 0);
  const totalCollectedPaise = accounts.reduce((s, a) => s + a.totalRepaidPaise, 0);

  const udhaarRows = await db.select({ status: udhaar.status }).from(udhaar);
  const udhaarByStatus: Record<string, number> = {};
  for (const r of udhaarRows) udhaarByStatus[r.status] = (udhaarByStatus[r.status] ?? 0) + 1;

  const paymentRows = await db.select({ status: payments.status }).from(payments);
  const paymentsByStatus: Record<string, number> = {};
  for (const p of paymentRows) paymentsByStatus[p.status] = (paymentsByStatus[p.status] ?? 0) + 1;

  const openDisputes = (
    await db.select({ id: disputes.id, status: disputes.status }).from(disputes)
  ).filter((d) => d.status !== 'RESOLVED' && d.status !== 'REJECTED').length;

  return {
    users: { total: allUsers.length, byRole: usersByRole, frozenOrSuspended },
    merchants: { total: allMerchants.length, byStatus: merchantsByStatus },
    udhaar: { total: udhaarRows.length, byStatus: udhaarByStatus },
    payments: { total: paymentRows.length, byStatus: paymentsByStatus },
    money: { totalOutstandingPaise, totalUdhaarVolumePaise, totalCollectedPaise },
    openDisputes,
  };
}

export async function listUsers(filters: { role?: UserRole; status?: UserStatus; q?: string }) {
  const conds = [];
  if (filters.role) conds.push(eq(users.role, filters.role));
  if (filters.status) conds.push(eq(users.status, filters.status));
  if (filters.q) {
    conds.push(or(like(users.mobile, `%${filters.q}%`), like(users.name, `%${filters.q}%`)));
  }
  const where = conds.length ? and(...conds) : undefined;
  return db
    .select({
      id: users.id,
      mobile: users.mobile,
      name: users.name,
      role: users.role,
      status: users.status,
      frozenReason: users.frozenReason,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt,
    })
    .from(users)
    .where(where)
    .orderBy(desc(users.createdAt))
    .limit(200);
}

/** Freeze / suspend / reactivate a user. Every change is audited. */
export async function setUserStatus(
  actor: { id: string; role: UserRole },
  userId: string,
  status: UserStatus,
  reason: string | undefined,
) {
  if (userId === actor.id) throw new BadRequestError('You cannot change your own account status');
  const [target] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!target) throw new NotFoundError('User not found');

  await db
    .update(users)
    .set({ status, frozenReason: status === 'ACTIVE' ? null : reason ?? null, updatedAt: new Date() })
    .where(eq(users.id, userId));

  await writeAudit(db, {
    actorUserId: actor.id,
    actorRole: actor.role,
    action: 'ADMIN_USER_STATUS_CHANGED',
    entityType: 'user',
    entityId: userId,
    summary: `User ${target.mobile} → ${status}${reason ? ` (${reason})` : ''}`,
    metadata: { from: target.status, to: status, reason },
  });

  return { id: userId, status, frozenReason: status === 'ACTIVE' ? null : reason ?? null };
}

export async function listMerchants(filters: { status?: MerchantStatus }) {
  const where = filters.status ? eq(merchants.status, filters.status) : undefined;
  const rows = await db
    .select({
      id: merchants.id,
      shopName: merchants.shopName,
      city: merchants.city,
      status: merchants.status,
      ownerUserId: merchants.ownerUserId,
      createdAt: merchants.createdAt,
    })
    .from(merchants)
    .where(where)
    .orderBy(desc(merchants.createdAt))
    .limit(200);
  return rows;
}

/** Suspend / activate a merchant. Audited. */
export async function setMerchantStatus(
  actor: { id: string; role: UserRole },
  merchantId: string,
  status: MerchantStatus,
  reason: string | undefined,
) {
  const [m] = await db.select().from(merchants).where(eq(merchants.id, merchantId)).limit(1);
  if (!m) throw new NotFoundError('Merchant not found');

  await db.update(merchants).set({ status, updatedAt: new Date() }).where(eq(merchants.id, merchantId));

  await writeAudit(db, {
    actorUserId: actor.id,
    actorRole: actor.role,
    action: 'ADMIN_MERCHANT_STATUS_CHANGED',
    entityType: 'merchant',
    entityId: merchantId,
    summary: `Shop ${m.shopName} → ${status}${reason ? ` (${reason})` : ''}`,
    metadata: { from: m.status, to: status, reason },
  });

  return { id: merchantId, status };
}
