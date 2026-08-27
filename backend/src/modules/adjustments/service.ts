import { eq } from 'drizzle-orm';
import type { Tx } from '../../db/client';
import { db } from '../../db/client';
import { adjustments, merchants, udhaar, udhaarEvents } from '../../db/schema';
import type { UserRole } from '../../db/schema/enums';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../core/errors';
import { postLedgerTransaction } from '../ledger/service';
import { createReceipt } from '../receipts/service';
import { notify } from '../notifications/service';
import { writeAudit } from '../audit/service';

export interface AdjustmentInput {
  udhaarId: string;
  /** Signed paise. Negative reduces what the customer owes; positive increases it. */
  amountPaise: number;
  reason: string;
  disputeId?: string;
}

/**
 * Apply a correction as a NEW signed ledger entry (type ADJUSTMENT). The original
 * transactions are never edited or deleted. Runs inside a caller-provided txn so
 * disputes can resolve-and-adjust atomically.
 */
export async function applyAdjustmentTx(
  tx: Tx,
  actor: { id: string; role: UserRole },
  input: AdjustmentInput,
) {
  if (!Number.isInteger(input.amountPaise) || input.amountPaise === 0) {
    throw new BadRequestError('Adjustment must be a non-zero integer in paise');
  }
  if (!input.reason?.trim()) throw new BadRequestError('A reason is required for every adjustment');

  const [row] = await tx.select().from(udhaar).where(eq(udhaar.id, input.udhaarId)).limit(1);
  if (!row) throw new NotFoundError('Udhaar not found');

  const newOutstanding = row.outstandingPaise + input.amountPaise;
  if (newOutstanding < 0) {
    throw new BadRequestError('Adjustment would make the outstanding negative');
  }

  const { transaction, balanceAfterPaise } = await postLedgerTransaction(tx, {
    accountId: row.accountId,
    udhaarId: row.id,
    type: 'ADJUSTMENT',
    method: 'SYSTEM',
    amountPaise: input.amountPaise,
    description: `Adjustment: ${input.reason}`,
    referenceType: 'adjustment',
    referenceId: input.disputeId,
    createdByUserId: actor.id,
  });

  const cleared = newOutstanding === 0;
  await tx
    .update(udhaar)
    .set({
      outstandingPaise: newOutstanding,
      status: cleared ? 'CLEARED' : row.status === 'CLEARED' ? 'ACTIVE' : row.status,
      clearedAt: cleared ? new Date() : row.status === 'CLEARED' ? null : row.clearedAt,
      updatedAt: new Date(),
    })
    .where(eq(udhaar.id, row.id));

  const [adjustment] = await tx
    .insert(adjustments)
    .values({
      udhaarId: row.id,
      accountId: row.accountId,
      amountPaise: input.amountPaise,
      reason: input.reason,
      referenceTxnId: transaction.id,
      disputeId: input.disputeId,
      createdByUserId: actor.id,
    })
    .returning();

  await createReceipt(tx, {
    type: 'ADJUSTMENT',
    udhaarId: row.id,
    merchantId: row.merchantId,
    customerUserId: row.customerUserId,
    amountPaise: input.amountPaise,
    outstandingAfterPaise: newOutstanding,
    snapshot: {
      ref: row.ref,
      adjustmentPaise: input.amountPaise,
      reason: input.reason,
      outstandingBeforePaise: row.outstandingPaise,
      outstandingAfterPaise: newOutstanding,
    },
  });

  await tx.insert(udhaarEvents).values({
    udhaarId: row.id,
    type: 'ADJUSTMENT',
    title: input.amountPaise < 0 ? 'Balance reduced (adjustment)' : 'Balance increased (adjustment)',
    description: `${input.reason} — ₹${(Math.abs(input.amountPaise) / 100).toLocaleString('en-IN')}`,
    amountPaise: input.amountPaise,
    actorUserId: actor.id,
    actorRole: actor.role,
  });

  await notify(tx, {
    userId: row.customerUserId,
    type: 'ADJUSTMENT',
    title: 'Your balance was adjusted',
    body: `${input.reason}. Outstanding now ₹${(newOutstanding / 100).toLocaleString('en-IN')}.`,
    data: { udhaarId: row.id, ref: row.ref },
  });

  await writeAudit(tx, {
    actorUserId: actor.id,
    actorRole: actor.role,
    action: 'ADJUSTMENT_CREATED',
    entityType: 'udhaar',
    entityId: row.id,
    summary: `Adjustment ₹${(input.amountPaise / 100).toLocaleString('en-IN')} on ${row.ref}: ${input.reason}`,
    metadata: { amountPaise: input.amountPaise, disputeId: input.disputeId },
  });

  return { adjustment, balanceAfterPaise, outstandingPaise: newOutstanding, cleared };
}

export async function createAdjustment(actor: { id: string; role: UserRole }, input: AdjustmentInput) {
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(udhaar).where(eq(udhaar.id, input.udhaarId)).limit(1);
    if (!row) throw new NotFoundError('Udhaar not found');

    // Authorisation: the shop that owns the khata, or an admin.
    if (actor.role !== 'ADMIN') {
      const [m] = await tx.select().from(merchants).where(eq(merchants.id, row.merchantId)).limit(1);
      if (!m || m.ownerUserId !== actor.id) {
        throw new ForbiddenError('Only the shop or an admin can adjust this balance');
      }
    }

    return applyAdjustmentTx(tx, actor, input);
  });
}
