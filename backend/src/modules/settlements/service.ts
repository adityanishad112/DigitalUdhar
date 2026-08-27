import { desc, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { settlements } from '../../db/schema';
import type { UserRole } from '../../db/schema/enums';
import { NotFoundError } from '../../core/errors';
import { secureToken } from '../../core/ids';
import { writeAudit } from '../audit/service';
import { resolveMerchantId } from '../merchants/service';

export async function listSettlements(requester: { id: string; role: UserRole }) {
  if (requester.role === 'ADMIN') {
    return db.select().from(settlements).orderBy(desc(settlements.createdAt)).limit(200);
  }
  const mid = await resolveMerchantId(requester.id, requester.role);
  if (!mid) return [];
  return db
    .select()
    .from(settlements)
    .where(eq(settlements.merchantId, mid))
    .orderBy(desc(settlements.createdAt))
    .limit(200);
}

export async function summarizeSettlements(requester: { id: string; role: UserRole }) {
  const rows = await listSettlements(requester);
  const pendingPaise = rows.filter((r) => r.status === 'PENDING').reduce((s, r) => s + r.netPaise, 0);
  const settledPaise = rows.filter((r) => r.status === 'SETTLED').reduce((s, r) => s + r.netPaise, 0);
  return { pendingPaise, settledPaise, count: rows.length, rows };
}

/** Admin marks a settlement as paid out to the merchant. Audited. */
export async function markSettled(actor: { id: string; role: UserRole }, settlementId: string) {
  const [row] = await db.select().from(settlements).where(eq(settlements.id, settlementId)).limit(1);
  if (!row) throw new NotFoundError('Settlement not found');

  const reference = row.reference ?? `payout_${secureToken(10)}`;
  await db
    .update(settlements)
    .set({ status: 'SETTLED', settledAt: new Date(), reference, updatedAt: new Date() })
    .where(eq(settlements.id, settlementId));

  await writeAudit(db, {
    actorUserId: actor.id,
    actorRole: actor.role,
    action: 'SETTLEMENT_PAID',
    entityType: 'settlement',
    entityId: settlementId,
    summary: `Settlement ${settlementId} marked SETTLED (net ₹${(row.netPaise / 100).toLocaleString('en-IN')})`,
    metadata: { netPaise: row.netPaise },
  });

  return { id: settlementId, status: 'SETTLED' as const, reference };
}
