import { and, desc, eq, sql } from 'drizzle-orm';
import type { Tx } from '../../db/client';
import { db } from '../../db/client';
import {
  ledgerAccounts,
  merchants,
  promiseToPay,
  udhaar,
  udhaarEvents,
  users,
} from '../../db/schema';
import type { UdhaarItem } from '../../db/schema/udhaar';
import type {
  LedgerMethod,
  PaymentMethod,
  ScheduleBucket,
  UdhaarStatus,
  UserRole,
} from '../../db/schema/enums';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../core/errors';
import { formatUdhaarRef } from '../../core/ids';
import { assertValidAmountPaise } from '../../core/money';
import { getOrCreateAccount, postLedgerTransaction } from '../ledger/service';
import { getOrCreateRelationship } from '../merchants/service';
import { createReceipt } from '../receipts/service';
import { notify } from '../notifications/service';

export type Udhaar = typeof udhaar.$inferSelect;

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

async function nextUdhaarRef(tx: Tx): Promise<string> {
  const [{ c }] = await tx.select({ c: sql<number>`count(*)` }).from(udhaar);
  return formatUdhaarRef(Number(c) + 1);
}

interface AddEventInput {
  udhaarId: string;
  type: string;
  title: string;
  description?: string;
  amountPaise?: number;
  actorUserId?: string | null;
  actorRole?: string | null;
  metadata?: Record<string, unknown>;
}

async function addEvent(tx: Tx, e: AddEventInput) {
  await tx.insert(udhaarEvents).values({
    udhaarId: e.udhaarId,
    type: e.type,
    title: e.title,
    description: e.description,
    amountPaise: e.amountPaise,
    actorUserId: e.actorUserId ?? null,
    actorRole: e.actorRole ?? null,
    metadata: e.metadata,
  });
}

/**
 * Append a REFUND entry to an udhaar's evidence timeline. Called by the payments
 * service inside the same transaction as the refund's ledger row, so the vault
 * explains WHY a cleared udhaar reverted to active. Append-only — never edits
 * the original REPAYMENT/CLEARED events.
 */
export async function addRefundEvent(
  tx: Tx,
  args: {
    udhaarId: string;
    amountPaise: number;
    newOutstandingPaise: number;
    paymentRef: string;
    paymentId: string;
    actorUserId: string;
    actorRole: UserRole;
  },
) {
  await addEvent(tx, {
    udhaarId: args.udhaarId,
    type: 'REFUND',
    title: 'Refund processed',
    description: `₹${(args.amountPaise / 100).toLocaleString('en-IN')} refunded against ${args.paymentRef}. Outstanding now ₹${(args.newOutstandingPaise / 100).toLocaleString('en-IN')}.`,
    amountPaise: args.amountPaise,
    actorUserId: args.actorUserId,
    actorRole: args.actorRole,
    metadata: { paymentId: args.paymentId, refund: true },
  });
}

async function merchantOwner(tx: Tx, merchantId: string) {
  const [m] = await tx.select().from(merchants).where(eq(merchants.id, merchantId)).limit(1);
  if (!m) throw new NotFoundError('Shop not found');
  return m;
}

// ---------------------------------------------------------------------------
// Take udhaar (customer initiates) → REQUESTED
// ---------------------------------------------------------------------------
export interface RequestUdhaarInput {
  merchantId: string;
  principalPaise: number;
  items?: UdhaarItem[];
  note?: string;
  billRef?: string;
  dueDate?: Date;
}

export async function requestUdhaar(customerUserId: string, input: RequestUdhaarInput) {
  assertValidAmountPaise(input.principalPaise);

  return db.transaction(async (tx) => {
    const relationship = await getOrCreateRelationship(tx, input.merchantId, customerUserId);
    if (relationship.status !== 'ACTIVE') {
      throw new ForbiddenError('This shop is not accepting udhaar from you right now');
    }

    const merchant = await merchantOwner(tx, input.merchantId);
    const account = await getOrCreateAccount(tx, input.merchantId, customerUserId);

    const maxTxn = relationship.maxTxnPaise ?? merchant.defaultMaxTxnPaise ?? 0;
    if (maxTxn > 0 && input.principalPaise > maxTxn) {
      throw new BadRequestError(
        `This shop limits a single udhaar to ₹${(maxTxn / 100).toLocaleString('en-IN')}`,
      );
    }

    const creditLimit = relationship.creditLimitPaise ?? merchant.defaultCreditLimitPaise ?? 0;
    const projected = account.balancePaise + input.principalPaise;
    const limitExceeded = creditLimit > 0 && projected > creditLimit;

    const termsDays = relationship.termsDays ?? merchant.defaultTermsDays ?? 15;
    const dueDate =
      input.dueDate ?? new Date(Date.now() + termsDays * 24 * 60 * 60 * 1000);

    const ref = await nextUdhaarRef(tx);
    const [row] = await tx
      .insert(udhaar)
      .values({
        ref,
        accountId: account.id,
        merchantId: input.merchantId,
        customerUserId,
        createdByUserId: customerUserId,
        principalPaise: input.principalPaise,
        outstandingPaise: input.principalPaise,
        status: 'REQUESTED',
        items: input.items,
        note: input.note,
        billRef: input.billRef,
        dueDate,
        customerConfirmed: true,
        merchantConfirmed: false,
        limitExceeded,
      })
      .returning();

    await addEvent(tx, {
      udhaarId: row.id,
      type: 'REQUESTED',
      title: 'Udhaar requested',
      description: `Customer requested ₹${(input.principalPaise / 100).toLocaleString('en-IN')}`,
      amountPaise: input.principalPaise,
      actorUserId: customerUserId,
      actorRole: 'CUSTOMER',
      metadata: { limitExceeded },
    });

    await notify(tx, {
      userId: merchant.ownerUserId,
      type: 'UDHAAR_REQUESTED',
      title: 'New udhaar request',
      body: `A customer has requested ₹${(input.principalPaise / 100).toLocaleString('en-IN')} (${ref})`,
      data: { udhaarId: row.id, ref, limitExceeded },
    });

    return row;
  });
}

// ---------------------------------------------------------------------------
// Merchant accept → ACTIVE (posts the immutable ledger entry)
// ---------------------------------------------------------------------------
export async function acceptUdhaar(
  merchantId: string,
  udhaarId: string,
  actorUserId: string,
  actorRole: UserRole,
) {
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(udhaar).where(eq(udhaar.id, udhaarId)).limit(1);
    if (!row) throw new NotFoundError('Udhaar not found');
    if (row.merchantId !== merchantId) throw new ForbiddenError('This udhaar belongs to another shop');
    if (row.status !== 'REQUESTED') {
      throw new ConflictError(`Cannot accept an udhaar that is ${row.status}`);
    }

    const { balanceAfterPaise } = await postLedgerTransaction(tx, {
      accountId: row.accountId,
      udhaarId: row.id,
      type: 'UDHAAR_CREATED',
      method: 'SYSTEM',
      amountPaise: row.principalPaise,
      description: `Udhaar ${row.ref} accepted`,
      referenceType: 'udhaar',
      referenceId: row.id,
      createdByUserId: actorUserId,
    });

    const [updated] = await tx
      .update(udhaar)
      .set({
        status: 'ACTIVE',
        merchantConfirmed: true,
        acceptedAt: new Date(),
        outstandingPaise: row.principalPaise,
        updatedAt: new Date(),
      })
      .where(eq(udhaar.id, row.id))
      .returning();

    const receipt = await createReceipt(tx, {
      type: 'UDHAAR_CREATED',
      udhaarId: row.id,
      merchantId: row.merchantId,
      customerUserId: row.customerUserId,
      amountPaise: row.principalPaise,
      outstandingAfterPaise: updated.outstandingPaise,
      snapshot: {
        ref: row.ref,
        principalPaise: row.principalPaise,
        items: row.items,
        note: row.note,
        dueDate: row.dueDate,
        acceptedBy: actorUserId,
      },
    });

    await addEvent(tx, {
      udhaarId: row.id,
      type: 'ACCEPTED',
      title: 'Udhaar accepted',
      description: 'Merchant accepted the udhaar. A digital agreement was created.',
      amountPaise: row.principalPaise,
      actorUserId,
      actorRole,
    });

    await notify(tx, {
      userId: row.customerUserId,
      type: 'UDHAAR_ACCEPTED',
      title: 'Udhaar approved',
      body: `Your udhaar ${row.ref} for ₹${(row.principalPaise / 100).toLocaleString('en-IN')} was approved`,
      data: { udhaarId: row.id, ref: row.ref },
    });

    return { udhaar: updated, balanceAfterPaise, receipt };
  });
}

// ---------------------------------------------------------------------------
// Merchant reject → REJECTED (no ledger entry ever created)
// ---------------------------------------------------------------------------
export async function rejectUdhaar(
  merchantId: string,
  udhaarId: string,
  reason: string | undefined,
  actorUserId: string,
  actorRole: UserRole,
) {
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(udhaar).where(eq(udhaar.id, udhaarId)).limit(1);
    if (!row) throw new NotFoundError('Udhaar not found');
    if (row.merchantId !== merchantId) throw new ForbiddenError('This udhaar belongs to another shop');
    if (row.status !== 'REQUESTED') {
      throw new ConflictError(`Cannot reject an udhaar that is ${row.status}`);
    }

    const [updated] = await tx
      .update(udhaar)
      .set({
        status: 'REJECTED',
        rejectedAt: new Date(),
        rejectedReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(udhaar.id, row.id))
      .returning();

    await addEvent(tx, {
      udhaarId: row.id,
      type: 'REJECTED',
      title: 'Udhaar rejected',
      description: reason ?? 'Merchant declined the request',
      actorUserId,
      actorRole,
    });

    await notify(tx, {
      userId: row.customerUserId,
      type: 'UDHAAR_REJECTED',
      title: 'Udhaar declined',
      body: `Your udhaar request ${row.ref} was declined${reason ? `: ${reason}` : ''}`,
      data: { udhaarId: row.id, ref: row.ref },
    });

    return updated;
  });
}

// ---------------------------------------------------------------------------
// Shared repayment routine (used by digital webhook + cash recording)
// ---------------------------------------------------------------------------
export interface ApplyRepaymentParams {
  udhaarRow: Udhaar;
  amountPaise: number;
  ledgerMethod: LedgerMethod;
  paymentMethod: PaymentMethod;
  createdByUserId?: string | null;
  actorRole?: string | null;
  paymentId?: string | null;
  referenceType?: string;
  referenceId?: string;
}

/** Post a repayment, shrink the outstanding, clear at ₹0, emit receipt + events. */
export async function applyRepaymentTx(tx: Tx, p: ApplyRepaymentParams) {
  const row = p.udhaarRow;
  if (row.status !== 'ACTIVE') {
    throw new ConflictError(`Cannot repay an udhaar that is ${row.status}`);
  }
  if (p.amountPaise <= 0) throw new BadRequestError('Repayment must be positive');
  if (p.amountPaise > row.outstandingPaise) {
    throw new BadRequestError('Repayment exceeds the outstanding amount');
  }

  const { balanceAfterPaise } = await postLedgerTransaction(tx, {
    accountId: row.accountId,
    udhaarId: row.id,
    type: 'REPAYMENT',
    method: p.ledgerMethod,
    amountPaise: -p.amountPaise,
    description: `Repayment against ${row.ref}`,
    referenceType: p.referenceType ?? 'repayment',
    referenceId: p.referenceId,
    createdByUserId: p.createdByUserId ?? null,
  });

  const newOutstanding = row.outstandingPaise - p.amountPaise;
  const cleared = newOutstanding === 0;

  const [updated] = await tx
    .update(udhaar)
    .set({
      outstandingPaise: newOutstanding,
      status: cleared ? 'CLEARED' : 'ACTIVE',
      clearedAt: cleared ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(udhaar.id, row.id))
    .returning();

  const receipt = await createReceipt(tx, {
    type: p.ledgerMethod === 'CASH' ? 'CASH_REPAYMENT' : 'REPAYMENT',
    udhaarId: row.id,
    paymentId: p.paymentId ?? null,
    merchantId: row.merchantId,
    customerUserId: row.customerUserId,
    amountPaise: p.amountPaise,
    outstandingAfterPaise: newOutstanding,
    method: p.paymentMethod,
    snapshot: {
      ref: row.ref,
      repaidPaise: p.amountPaise,
      outstandingBeforePaise: row.outstandingPaise,
      outstandingAfterPaise: newOutstanding,
      method: p.paymentMethod,
      cleared,
    },
  });

  await addEvent(tx, {
    udhaarId: row.id,
    type: p.ledgerMethod === 'CASH' ? 'CASH_REPAYMENT' : 'REPAYMENT',
    title: p.ledgerMethod === 'CASH' ? 'Cash repayment recorded' : 'Repayment received',
    description: `₹${(p.amountPaise / 100).toLocaleString('en-IN')} repaid. Outstanding now ₹${(newOutstanding / 100).toLocaleString('en-IN')}.`,
    amountPaise: p.amountPaise,
    actorUserId: p.createdByUserId ?? null,
    actorRole: p.actorRole ?? null,
    // Carry the payment id so a merchant can initiate a refund of THIS
    // repayment from the evidence timeline. Cash repayments have no gateway
    // payment, so they intentionally get no refund affordance.
    metadata: p.paymentId ? { paymentId: p.paymentId } : undefined,
  });

  // Any pending promise-to-pay is fulfilled once the balance is cleared.
  if (cleared) {
    await tx
      .update(promiseToPay)
      .set({ status: 'FULFILLED', fulfilledAt: new Date(), updatedAt: new Date() })
      .where(and(eq(promiseToPay.udhaarId, row.id), eq(promiseToPay.status, 'PENDING')));

    await addEvent(tx, {
      udhaarId: row.id,
      type: 'CLEARED',
      title: 'Udhaar cleared',
      description: 'Outstanding is now ₹0. This udhaar is fully settled.',
      actorUserId: p.createdByUserId ?? null,
      actorRole: p.actorRole ?? null,
    });

    await notify(tx, {
      userId: row.customerUserId,
      type: 'UDHAAR_CLEARED',
      title: 'Udhaar cleared 🎉',
      body: `Your udhaar ${row.ref} is fully settled. Outstanding ₹0.`,
      data: { udhaarId: row.id, ref: row.ref },
    });
  }

  // Notify the counterparties of the repayment itself.
  const merchant = await merchantOwner(tx, row.merchantId);
  if (p.ledgerMethod === 'CASH') {
    await notify(tx, {
      userId: row.customerUserId,
      type: 'CASH_RECORDED',
      title: 'Cash repayment recorded',
      body: `The shop recorded ₹${(p.amountPaise / 100).toLocaleString('en-IN')} cash against ${row.ref}`,
      data: { udhaarId: row.id, ref: row.ref },
    });
  } else {
    await notify(tx, {
      userId: merchant.ownerUserId,
      type: 'PAYMENT_RECEIVED',
      title: 'Payment received',
      body: `₹${(p.amountPaise / 100).toLocaleString('en-IN')} received against ${row.ref}`,
      data: { udhaarId: row.id, ref: row.ref },
    });
  }

  return { udhaar: updated, balanceAfterPaise, receipt, cleared };
}

// ---------------------------------------------------------------------------
// Cash repayment (merchant/staff records money taken in person)
// ---------------------------------------------------------------------------
export async function recordCashRepayment(
  merchantId: string,
  udhaarId: string,
  amountPaise: number,
  actorUserId: string,
  actorRole: UserRole,
) {
  assertValidAmountPaise(amountPaise);
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(udhaar).where(eq(udhaar.id, udhaarId)).limit(1);
    if (!row) throw new NotFoundError('Udhaar not found');
    if (row.merchantId !== merchantId) throw new ForbiddenError('This udhaar belongs to another shop');

    return applyRepaymentTx(tx, {
      udhaarRow: row,
      amountPaise,
      ledgerMethod: 'CASH',
      paymentMethod: 'CASH',
      createdByUserId: actorUserId,
      actorRole,
      referenceType: 'cash_repayment',
    });
  });
}

// ---------------------------------------------------------------------------
// Promise to pay (customer)
// ---------------------------------------------------------------------------
export async function createPromiseToPay(
  customerUserId: string,
  udhaarId: string,
  promisedDate: Date,
  amountPaise: number | undefined,
  note: string | undefined,
) {
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(udhaar).where(eq(udhaar.id, udhaarId)).limit(1);
    if (!row) throw new NotFoundError('Udhaar not found');
    if (row.customerUserId !== customerUserId) throw new ForbiddenError('Not your udhaar');
    if (row.status !== 'ACTIVE' || row.outstandingPaise <= 0) {
      throw new ConflictError('Only an active, unpaid udhaar can have a promise to pay');
    }

    const amount = amountPaise ?? row.outstandingPaise;
    if (amount <= 0 || amount > row.outstandingPaise) {
      throw new BadRequestError('Promise amount must be within the outstanding');
    }

    // Supersede any earlier pending promise.
    await tx
      .update(promiseToPay)
      .set({ status: 'CANCELLED', updatedAt: new Date() })
      .where(and(eq(promiseToPay.udhaarId, row.id), eq(promiseToPay.status, 'PENDING')));

    const [promise] = await tx
      .insert(promiseToPay)
      .values({
        udhaarId: row.id,
        customerUserId,
        promisedDate,
        amountPaise: amount,
        note,
      })
      .returning();

    await addEvent(tx, {
      udhaarId: row.id,
      type: 'PROMISE_CREATED',
      title: 'Promise to pay',
      description: `Customer promised ₹${(amount / 100).toLocaleString('en-IN')} by ${promisedDate.toLocaleDateString('en-IN')}`,
      amountPaise: amount,
      actorUserId: customerUserId,
      actorRole: 'CUSTOMER',
    });

    const merchant = await merchantOwner(tx, row.merchantId);
    await notify(tx, {
      userId: merchant.ownerUserId,
      type: 'PROMISE_CREATED',
      title: 'Customer promised to pay',
      body: `A promise of ₹${(amount / 100).toLocaleString('en-IN')} was made for ${row.ref}`,
      data: { udhaarId: row.id, ref: row.ref },
    });

    return promise;
  });
}

// ---------------------------------------------------------------------------
// Reads / derived schedule buckets
// ---------------------------------------------------------------------------
export function computeBucket(
  row: Pick<Udhaar, 'status' | 'dueDate' | 'outstandingPaise'>,
  pendingPromise?: { promisedDate: Date } | null,
): ScheduleBucket | UdhaarStatus {
  if (row.status === 'REQUESTED') return 'REQUESTED';
  if (row.status === 'DISPUTED') return 'DISPUTED';
  if (row.status === 'CLEARED') return 'CLEARED';
  if (row.status === 'REJECTED' || row.status === 'CANCELLED') return row.status;

  const today = startOfDay(new Date()).getTime();

  if (pendingPromise) {
    const pd = startOfDay(pendingPromise.promisedDate).getTime();
    return pd < today ? 'PROMISE_MISSED' : 'PROMISE_TO_PAY';
  }

  const due = startOfDay(row.dueDate).getTime();
  if (due === today) return 'DUE_TODAY';
  if (due < today) return 'OVERDUE';
  return 'UPCOMING';
}

async function pendingPromiseFor(udhaarId: string) {
  const [p] = await db
    .select()
    .from(promiseToPay)
    .where(and(eq(promiseToPay.udhaarId, udhaarId), eq(promiseToPay.status, 'PENDING')))
    .orderBy(desc(promiseToPay.createdAt))
    .limit(1);
  return p ?? null;
}

export async function listUdhaarForCustomer(customerUserId: string) {
  const rows = await db
    .select({
      u: udhaar,
      shopName: merchants.shopName,
      merchantCity: merchants.city,
    })
    .from(udhaar)
    .innerJoin(merchants, eq(merchants.id, udhaar.merchantId))
    .where(eq(udhaar.customerUserId, customerUserId))
    .orderBy(desc(udhaar.createdAt));

  return Promise.all(
    rows.map(async (r) => {
      const promise = ['ACTIVE'].includes(r.u.status) ? await pendingPromiseFor(r.u.id) : null;
      return {
        ...r.u,
        shopName: r.shopName,
        merchantCity: r.merchantCity,
        bucket: computeBucket(r.u, promise),
        pendingPromise: promise,
      };
    }),
  );
}

export async function listUdhaarForMerchant(merchantId: string) {
  const rows = await db
    .select({
      u: udhaar,
      customerName: users.name,
      customerMobile: users.mobile,
    })
    .from(udhaar)
    .innerJoin(users, eq(users.id, udhaar.customerUserId))
    .where(eq(udhaar.merchantId, merchantId))
    .orderBy(desc(udhaar.createdAt));

  return Promise.all(
    rows.map(async (r) => {
      const promise = ['ACTIVE'].includes(r.u.status) ? await pendingPromiseFor(r.u.id) : null;
      return {
        ...r.u,
        customerName: r.customerName,
        customerMobile: r.customerMobile,
        bucket: computeBucket(r.u, promise),
        pendingPromise: promise,
      };
    }),
  );
}

/** Full detail + evidence timeline. Authorisation enforced by the caller/route. */
export async function getUdhaarDetail(udhaarId: string, requester: { id: string; role: UserRole }) {
  const [row] = await db.select().from(udhaar).where(eq(udhaar.id, udhaarId)).limit(1);
  if (!row) throw new NotFoundError('Udhaar not found');

  // Ownership: the customer on the khata, the shop that owns it (owner/staff), or admin.
  const isCustomer = requester.role === 'CUSTOMER' && row.customerUserId === requester.id;
  const isAdmin = requester.role === 'ADMIN';
  let isShop = false;
  if (requester.role === 'MERCHANT' || requester.role === 'STAFF') {
    const { resolveMerchantId } = await import('../merchants/service');
    const mid = await resolveMerchantId(requester.id, requester.role);
    isShop = mid === row.merchantId;
  }
  if (!isCustomer && !isShop && !isAdmin) {
    throw new ForbiddenError('You cannot view this udhaar');
  }

  const events = await db
    .select()
    .from(udhaarEvents)
    .where(eq(udhaarEvents.udhaarId, udhaarId))
    .orderBy(udhaarEvents.createdAt);

  const promises = await db
    .select()
    .from(promiseToPay)
    .where(eq(promiseToPay.udhaarId, udhaarId))
    .orderBy(desc(promiseToPay.createdAt));

  const [merchant] = await db.select().from(merchants).where(eq(merchants.id, row.merchantId)).limit(1);
  const [customer] = await db
    .select({ id: users.id, name: users.name, mobile: users.mobile })
    .from(users)
    .where(eq(users.id, row.customerUserId))
    .limit(1);
  const [account] = await db
    .select()
    .from(ledgerAccounts)
    .where(eq(ledgerAccounts.id, row.accountId))
    .limit(1);

  const pending = promises.find((p) => p.status === 'PENDING') ?? null;

  return {
    udhaar: { ...row, bucket: computeBucket(row, pending) },
    events,
    promises,
    merchant: merchant
      ? { id: merchant.id, shopName: merchant.shopName, city: merchant.city, upiId: merchant.upiId }
      : null,
    // Customers never see other customers; merchants see the customer they transact with.
    customer,
    account: account
      ? { outstandingPaise: account.balancePaise, totalUdhaarPaise: account.totalUdhaarPaise, totalRepaidPaise: account.totalRepaidPaise }
      : null,
  };
}

export async function getUdhaarRow(udhaarId: string): Promise<Udhaar | null> {
  const [row] = await db.select().from(udhaar).where(eq(udhaar.id, udhaarId)).limit(1);
  return row ?? null;
}
