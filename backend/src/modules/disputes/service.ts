import { and, desc, eq, or } from 'drizzle-orm';
import { db } from '../../db/client';
import {
  disputeEvidence,
  disputes,
  merchants,
  udhaar,
  udhaarEvents,
  users,
} from '../../db/schema';
import type { DisputeCategory, DisputeStatus, UserRole } from '../../db/schema/enums';
import { ConflictError, ForbiddenError, NotFoundError } from '../../core/errors';
import { shortCode } from '../../core/ids';
import { resolveMerchantId } from '../merchants/service';
import { applyAdjustmentTx } from '../adjustments/service';
import { notify } from '../notifications/service';
import { writeAudit } from '../audit/service';

export type Dispute = typeof disputes.$inferSelect;

async function assertParticipant(
  udhaarRow: typeof udhaar.$inferSelect,
  actor: { id: string; role: UserRole },
) {
  if (actor.role === 'ADMIN') return 'ADMIN' as const;
  if (actor.role === 'CUSTOMER' && udhaarRow.customerUserId === actor.id) return 'CUSTOMER' as const;
  if (actor.role === 'MERCHANT' || actor.role === 'STAFF') {
    const mid = await resolveMerchantId(actor.id, actor.role);
    if (mid === udhaarRow.merchantId) return 'SHOP' as const;
  }
  throw new ForbiddenError('You are not a participant in this udhaar');
}

export async function raiseDispute(
  actor: { id: string; role: UserRole },
  input: {
    udhaarId: string;
    category: DisputeCategory;
    description?: string;
    amountClaimedPaise?: number;
  },
) {
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(udhaar).where(eq(udhaar.id, input.udhaarId)).limit(1);
    if (!row) throw new NotFoundError('Udhaar not found');
    await assertParticipant(row, actor);
    if (row.status !== 'ACTIVE' && row.status !== 'CLEARED') {
      throw new ConflictError(`Cannot dispute an udhaar that is ${row.status}`);
    }

    const ref = `DSP-${shortCode(8)}`;
    const [dispute] = await tx
      .insert(disputes)
      .values({
        ref,
        udhaarId: row.id,
        raisedByUserId: actor.id,
        merchantId: row.merchantId,
        category: input.category,
        description: input.description,
        amountClaimedPaise: input.amountClaimedPaise,
        status: 'OPEN',
      })
      .returning();

    await tx.insert(disputeEvidence).values({
      disputeId: dispute.id,
      addedByUserId: actor.id,
      addedByRole: actor.role,
      kind: 'SYSTEM',
      text: `Dispute opened (${input.category})`,
    });
    if (input.description) {
      await tx.insert(disputeEvidence).values({
        disputeId: dispute.id,
        addedByUserId: actor.id,
        addedByRole: actor.role,
        kind: 'NOTE',
        text: input.description,
      });
    }

    // Freeze the udhaar while under dispute (restored on resolution).
    await tx.update(udhaar).set({ status: 'DISPUTED', disputedAt: new Date(), updatedAt: new Date() }).where(eq(udhaar.id, row.id));

    await tx.insert(udhaarEvents).values({
      udhaarId: row.id,
      type: 'DISPUTED',
      title: 'Dispute raised',
      description: `${input.category}${input.description ? ` — ${input.description}` : ''}`,
      actorUserId: actor.id,
      actorRole: actor.role,
    });

    // Notify the counterparty.
    const merchant = await tx.select().from(merchants).where(eq(merchants.id, row.merchantId)).limit(1);
    const counterpartyId = actor.id === row.customerUserId ? merchant[0]?.ownerUserId : row.customerUserId;
    if (counterpartyId) {
      await notify(tx, {
        userId: counterpartyId,
        type: 'DISPUTE_UPDATE',
        title: 'A dispute was raised',
        body: `Dispute ${ref} was opened on ${row.ref}`,
        data: { disputeId: dispute.id, udhaarId: row.id },
      });
    }

    return dispute;
  });
}

export async function addEvidence(
  actor: { id: string; role: UserRole },
  disputeId: string,
  text: string,
) {
  return db.transaction(async (tx) => {
    const [dispute] = await tx.select().from(disputes).where(eq(disputes.id, disputeId)).limit(1);
    if (!dispute) throw new NotFoundError('Dispute not found');
    const [row] = await tx.select().from(udhaar).where(eq(udhaar.id, dispute.udhaarId)).limit(1);
    await assertParticipant(row!, actor);

    const [evidence] = await tx
      .insert(disputeEvidence)
      .values({ disputeId, addedByUserId: actor.id, addedByRole: actor.role, kind: 'NOTE', text })
      .returning();

    const merchant = await tx.select().from(merchants).where(eq(merchants.id, dispute.merchantId)).limit(1);
    const counterpartyId = actor.id === row!.customerUserId ? merchant[0]?.ownerUserId : row!.customerUserId;
    if (counterpartyId) {
      await notify(tx, {
        userId: counterpartyId,
        type: 'DISPUTE_UPDATE',
        title: 'New note on a dispute',
        body: `New evidence added to ${dispute.ref}`,
        data: { disputeId, udhaarId: dispute.udhaarId },
      });
    }
    return evidence;
  });
}

export async function resolveDispute(
  actor: { id: string; role: UserRole },
  disputeId: string,
  input: {
    status: Extract<DisputeStatus, 'RESOLVED' | 'REJECTED'>;
    resolution: string;
    adjustmentPaise?: number;
    adjustmentReason?: string;
  },
) {
  return db.transaction(async (tx) => {
    const [dispute] = await tx.select().from(disputes).where(eq(disputes.id, disputeId)).limit(1);
    if (!dispute) throw new NotFoundError('Dispute not found');
    if (dispute.status === 'RESOLVED' || dispute.status === 'REJECTED') {
      throw new ConflictError('This dispute is already closed');
    }

    // Only the shop that owns it, or an admin, may resolve.
    if (actor.role !== 'ADMIN') {
      const [m] = await tx.select().from(merchants).where(eq(merchants.id, dispute.merchantId)).limit(1);
      if (!m || m.ownerUserId !== actor.id) {
        throw new ForbiddenError('Only the shop or an admin can resolve this dispute');
      }
    }

    // Optionally correct the balance as part of the resolution.
    if (input.status === 'RESOLVED' && input.adjustmentPaise && input.adjustmentPaise !== 0) {
      await applyAdjustmentTx(tx, actor, {
        udhaarId: dispute.udhaarId,
        amountPaise: input.adjustmentPaise,
        reason: input.adjustmentReason ?? `Dispute ${dispute.ref} resolution`,
        disputeId: dispute.id,
      });
    }

    // Restore the udhaar from DISPUTED to its natural state.
    const [row] = await tx.select().from(udhaar).where(eq(udhaar.id, dispute.udhaarId)).limit(1);
    if (row && row.status === 'DISPUTED') {
      const natural = row.outstandingPaise === 0 ? 'CLEARED' : 'ACTIVE';
      await tx
        .update(udhaar)
        .set({
          status: natural,
          disputedAt: null,
          clearedAt: natural === 'CLEARED' ? row.clearedAt ?? new Date() : row.clearedAt,
          updatedAt: new Date(),
        })
        .where(eq(udhaar.id, row.id));
    }

    const [updated] = await tx
      .update(disputes)
      .set({
        status: input.status,
        resolution: input.resolution,
        resolvedByUserId: actor.id,
        resolvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(disputes.id, disputeId))
      .returning();

    await tx.insert(disputeEvidence).values({
      disputeId,
      addedByUserId: actor.id,
      addedByRole: actor.role,
      kind: 'SYSTEM',
      text: `Dispute ${input.status.toLowerCase()}: ${input.resolution}`,
    });

    await tx.insert(udhaarEvents).values({
      udhaarId: dispute.udhaarId,
      type: 'DISPUTE_RESOLVED',
      title: `Dispute ${input.status.toLowerCase()}`,
      description: input.resolution,
      actorUserId: actor.id,
      actorRole: actor.role,
    });

    // Notify both parties.
    if (row) {
      const [m] = await tx.select().from(merchants).where(eq(merchants.id, dispute.merchantId)).limit(1);
      for (const uid of [row.customerUserId, m?.ownerUserId].filter(Boolean) as string[]) {
        await notify(tx, {
          userId: uid,
          type: 'DISPUTE_UPDATE',
          title: `Dispute ${input.status.toLowerCase()}`,
          body: `Dispute ${dispute.ref}: ${input.resolution}`,
          data: { disputeId, udhaarId: dispute.udhaarId },
        });
      }
    }

    await writeAudit(tx, {
      actorUserId: actor.id,
      actorRole: actor.role,
      action: 'DISPUTE_RESOLVED',
      entityType: 'dispute',
      entityId: disputeId,
      summary: `Dispute ${dispute.ref} ${input.status}`,
      metadata: { adjustmentPaise: input.adjustmentPaise ?? 0 },
    });

    return updated;
  });
}

export async function listDisputes(requester: { id: string; role: UserRole }) {
  if (requester.role === 'ADMIN') {
    return db.select().from(disputes).orderBy(desc(disputes.createdAt));
  }
  if (requester.role === 'CUSTOMER') {
    return db
      .select({ d: disputes })
      .from(disputes)
      .innerJoin(udhaar, eq(udhaar.id, disputes.udhaarId))
      .where(eq(udhaar.customerUserId, requester.id))
      .orderBy(desc(disputes.createdAt))
      .then((rows) => rows.map((r) => r.d));
  }
  const mid = await resolveMerchantId(requester.id, requester.role);
  if (!mid) return [];
  return db.select().from(disputes).where(eq(disputes.merchantId, mid)).orderBy(desc(disputes.createdAt));
}

export async function getDispute(disputeId: string, requester: { id: string; role: UserRole }) {
  const [dispute] = await db.select().from(disputes).where(eq(disputes.id, disputeId)).limit(1);
  if (!dispute) throw new NotFoundError('Dispute not found');
  const [row] = await db.select().from(udhaar).where(eq(udhaar.id, dispute.udhaarId)).limit(1);
  await assertParticipant(row!, requester);

  const evidence = await db
    .select()
    .from(disputeEvidence)
    .where(eq(disputeEvidence.disputeId, disputeId))
    .orderBy(disputeEvidence.createdAt);

  return { dispute, udhaar: row ? { id: row.id, ref: row.ref, status: row.status, outstandingPaise: row.outstandingPaise } : null, evidence };
}

void and;
void or;
void users;
