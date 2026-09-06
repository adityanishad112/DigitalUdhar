import { desc, eq } from 'drizzle-orm';
import type { Tx } from '../../db/client';
import { db } from '../../db/client';
import {
  merchants,
  paymentOrders,
  paymentWebhooks,
  payments,
  refunds,
  settlements,
  udhaar,
} from '../../db/schema';
import type { PaymentMethod, UserRole } from '../../db/schema/enums';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from '../../core/errors';
import { CONFIG } from '../../core/config';
import { formatPaymentRef, secureToken } from '../../core/ids';
import { postLedgerTransaction } from '../ledger/service';
import { addRefundEvent, applyRepaymentTx } from '../udhaar/service';
import { createReceipt } from '../receipts/service';
import { notify } from '../notifications/service';
import { writeAudit } from '../audit/service';
import { getGateway, mockPaymentId } from './gateway';

export type Payment = typeof payments.$inferSelect;

function feeFor(amountPaise: number): number {
  return Math.round((amountPaise * CONFIG.gateway.feePercent) / 100);
}

// ---------------------------------------------------------------------------
// Create order (customer initiates a digital repayment)
// ---------------------------------------------------------------------------
export interface CreateOrderInput {
  udhaarId: string;
  amountPaise: number;
  method?: PaymentMethod;
  idempotencyKey?: string;
}

export async function createOrder(customerUserId: string, input: CreateOrderInput) {
  if (!Number.isInteger(input.amountPaise) || input.amountPaise <= 0) {
    throw new BadRequestError('Amount must be a positive integer in paise');
  }

  const [row] = await db.select().from(udhaar).where(eq(udhaar.id, input.udhaarId)).limit(1);
  if (!row) throw new NotFoundError('Udhaar not found');
  if (row.customerUserId !== customerUserId) throw new ForbiddenError('Not your udhaar');
  if (row.status !== 'ACTIVE') throw new ConflictError(`Cannot pay an udhaar that is ${row.status}`);
  if (input.amountPaise > row.outstandingPaise) {
    throw new BadRequestError('Amount exceeds the outstanding balance');
  }

  const idempotencyKey = input.idempotencyKey ?? `auto_${secureToken(12)}`;

  // Idempotent create: the same key returns the existing payment + order.
  const [existing] = await db
    .select()
    .from(payments)
    .where(eq(payments.idempotencyKey, idempotencyKey))
    .limit(1);
  if (existing) {
    const [order] = await db
      .select()
      .from(paymentOrders)
      .where(eq(paymentOrders.paymentId, existing.id))
      .limit(1);
    return {
      payment: existing,
      order: {
        gatewayOrderId: existing.gatewayOrderId,
        amountPaise: existing.amountPaise,
        currency: order?.currency ?? 'INR',
        keyId: getGateway().publicKeyId,
        provider: existing.gatewayProvider,
      },
      idempotent: true,
    };
  }

  const gateway = getGateway();
  const ref = formatPaymentRef();
  const createdOrder = await gateway.createOrder({
    amountPaise: input.amountPaise,
    receipt: ref,
    notes: { udhaarId: row.id, udhaarRef: row.ref },
  });

  const result = await db.transaction(async (tx) => {
    const [payment] = await tx
      .insert(payments)
      .values({
        ref,
        udhaarId: row.id,
        merchantId: row.merchantId,
        customerUserId,
        amountPaise: input.amountPaise,
        method: input.method ?? 'UPI',
        status: 'CREATED',
        idempotencyKey,
        gatewayProvider: gateway.provider,
        gatewayOrderId: createdOrder.gatewayOrderId,
        initiatedByUserId: customerUserId,
      })
      .returning();

    await tx.insert(paymentOrders).values({
      paymentId: payment.id,
      gatewayOrderId: createdOrder.gatewayOrderId,
      amountPaise: input.amountPaise,
      currency: createdOrder.currency,
      status: 'CREATED',
    });

    return payment;
  });

  return {
    payment: result,
    order: {
      gatewayOrderId: createdOrder.gatewayOrderId,
      amountPaise: createdOrder.amountPaise,
      currency: createdOrder.currency,
      keyId: gateway.publicKeyId,
      provider: gateway.provider,
    },
    idempotent: false,
  };
}

// ---------------------------------------------------------------------------
// Payment completion helper (used by both webhooks & verify endpoint)
// ---------------------------------------------------------------------------
export async function completePaymentSuccessTx(
  tx: Tx,
  fresh: Payment,
  gatewayPaymentId: string,
) {
  const [row] = await tx.select().from(udhaar).where(eq(udhaar.id, fresh.udhaarId)).limit(1);
  if (!row) throw new NotFoundError('Udhaar not found for payment');

  const repay = await applyRepaymentTx(tx, {
    udhaarRow: row,
    amountPaise: fresh.amountPaise,
    ledgerMethod: 'DIGITAL',
    paymentMethod: fresh.method,
    createdByUserId: fresh.customerUserId,
    actorRole: 'CUSTOMER',
    paymentId: fresh.id,
    referenceType: 'payment',
    referenceId: fresh.id,
  });

  const fee = feeFor(fresh.amountPaise);
  const net = fresh.amountPaise - fee;

  await tx
    .update(payments)
    .set({
      status: 'SUCCESS',
      gatewayPaymentId,
      feePaise: fee,
      netPaise: net,
      verifiedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(payments.id, fresh.id));

  await tx
    .update(paymentOrders)
    .set({ status: 'PAID', updatedAt: new Date() })
    .where(eq(paymentOrders.paymentId, fresh.id));

  // Merchant settlement (gross − gateway fee). Left PENDING for the sweeper.
  await tx.insert(settlements).values({
    merchantId: fresh.merchantId,
    paymentId: fresh.id,
    grossPaise: fresh.amountPaise,
    feePaise: fee,
    netPaise: net,
    status: 'PENDING',
  });

  return { cleared: repay.cleared };
}

// ---------------------------------------------------------------------------
// Webhook processing (signature verify + idempotency + apply in one txn)
// ---------------------------------------------------------------------------
export interface ParsedWebhook {
  eventId: string;
  event: string;
  gatewayOrderId?: string;
  gatewayPaymentId?: string;
  amountPaise?: number;
  failureReason?: string;
}

export function parseWebhook(rawBody: string, eventIdHeader?: string): ParsedWebhook {
  let json: any;
  try {
    json = JSON.parse(rawBody);
  } catch {
    throw new BadRequestError('Malformed webhook body');
  }

  // Support both Razorpay native payload schema:
  // payload.payment.entity.*, payload.order.entity.*
  // and JamaBaaki mock schema: payload.payment.*, payload.order.*
  const paymentEntity = json.payload?.payment?.entity ?? json.payload?.payment;
  const orderEntity = json.payload?.order?.entity ?? json.payload?.order;

  const event = json.event;
  const gatewayOrderId = orderEntity?.id ?? paymentEntity?.order_id;
  const gatewayPaymentId = paymentEntity?.id;
  const amountPaise = paymentEntity?.amount ?? paymentEntity?.amountPaise;
  const failureReason = paymentEntity?.error_description ?? paymentEntity?.failureReason;

  const eventId =
    eventIdHeader ||
    json.eventId ||
    json.id ||
    (event && (gatewayPaymentId || gatewayOrderId)
      ? `${event}_${gatewayPaymentId || gatewayOrderId}_${json.created_at ?? Date.now()}`
      : undefined);

  return {
    eventId: eventId ?? `bad_${secureToken(8)}`,
    event,
    gatewayOrderId,
    gatewayPaymentId,
    amountPaise,
    failureReason,
  };
}

export interface WebhookResult {
  status: 'PROCESSED' | 'DUPLICATE' | 'IGNORED' | 'ALREADY_FINAL';
  paymentId?: string;
  paymentStatus?: string;
  cleared?: boolean;
}

export async function processWebhook(
  rawBody: string,
  signature: string,
  eventIdHeader?: string,
): Promise<WebhookResult> {
  const gateway = getGateway();

  // 1. Signature first — never trust an unverified body.
  if (!gateway.verifyWebhookSignature({ body: rawBody, signature: signature ?? '' })) {
    try {
      const maybe = parseWebhook(rawBody, eventIdHeader);
      await db.insert(paymentWebhooks).values({
        eventId: maybe.eventId,
        provider: gateway.provider,
        eventType: maybe.event ?? 'unknown',
        signature,
        payload: JSON.parse(rawBody),
        status: 'INVALID_SIGNATURE',
      });
    } catch {
      /* best-effort logging only */
    }
    throw new UnauthorizedError('Invalid webhook signature');
  }

  const parsed = parseWebhook(rawBody, eventIdHeader);
  if (!parsed.eventId || !parsed.event) throw new BadRequestError('Missing webhook event fields');

  // 2. Idempotency — a duplicate delivery is recognised and never re-applied.
  const [seen] = await db
    .select()
    .from(paymentWebhooks)
    .where(eq(paymentWebhooks.eventId, parsed.eventId))
    .limit(1);
  if (seen) {
    return { status: 'DUPLICATE', paymentId: seen.paymentId ?? undefined };
  }

  // 3. Locate the payment.
  const [payment] = parsed.gatewayOrderId
    ? await db.select().from(payments).where(eq(payments.gatewayOrderId, parsed.gatewayOrderId)).limit(1)
    : [undefined];

  if (!payment) {
    await db.insert(paymentWebhooks).values({
      eventId: parsed.eventId,
      provider: gateway.provider,
      eventType: parsed.event,
      gatewayOrderId: parsed.gatewayOrderId,
      gatewayPaymentId: parsed.gatewayPaymentId,
      signature,
      payload: JSON.parse(rawBody),
      status: 'IGNORED',
    });
    return { status: 'IGNORED' };
  }

  // 4. Apply inside one transaction; the webhook row lives/dies with the effects.
  return db.transaction(async (tx) => {
    await tx.insert(paymentWebhooks).values({
      eventId: parsed.eventId,
      provider: gateway.provider,
      eventType: parsed.event,
      paymentId: payment.id,
      gatewayOrderId: parsed.gatewayOrderId,
      gatewayPaymentId: parsed.gatewayPaymentId,
      signature,
      payload: JSON.parse(rawBody),
      status: 'RECEIVED',
    });

    const [fresh] = await tx.select().from(payments).where(eq(payments.id, payment.id)).limit(1);
    if (fresh.status === 'SUCCESS' || fresh.status === 'FAILED') {
      await tx
        .update(paymentWebhooks)
        .set({ status: 'PROCESSED', processedAt: new Date() })
        .where(eq(paymentWebhooks.eventId, parsed.eventId));
      return { status: 'ALREADY_FINAL', paymentId: fresh.id, paymentStatus: fresh.status };
    }

    if (parsed.event === 'payment.captured') {
      const repay = await completePaymentSuccessTx(tx, fresh, parsed.gatewayPaymentId!);

      await tx
        .update(paymentWebhooks)
        .set({ status: 'PROCESSED', processedAt: new Date() })
        .where(eq(paymentWebhooks.eventId, parsed.eventId));

      return { status: 'PROCESSED', paymentId: fresh.id, paymentStatus: 'SUCCESS', cleared: repay.cleared };
    }

    if (parsed.event === 'payment.failed') {
      await tx
        .update(payments)
        .set({
          status: 'FAILED',
          failureReason: parsed.failureReason ?? 'Payment failed at gateway',
          gatewayPaymentId: parsed.gatewayPaymentId,
          updatedAt: new Date(),
        })
        .where(eq(payments.id, fresh.id));

      await tx
        .update(paymentOrders)
        .set({ status: 'FAILED', updatedAt: new Date() })
        .where(eq(paymentOrders.paymentId, fresh.id));

      await notify(tx, {
        userId: fresh.customerUserId,
        type: 'PAYMENT_FAILED',
        title: 'Payment failed',
        body: `Your payment ${fresh.ref} could not be completed. Please try again.`,
        data: { paymentId: fresh.id, udhaarId: fresh.udhaarId },
      });

      await tx
        .update(paymentWebhooks)
        .set({ status: 'PROCESSED', processedAt: new Date() })
        .where(eq(paymentWebhooks.eventId, parsed.eventId));

      return { status: 'PROCESSED', paymentId: fresh.id, paymentStatus: 'FAILED' };
    }

    // Unknown event type — record but take no financial action.
    await tx
      .update(paymentWebhooks)
      .set({ status: 'IGNORED', processedAt: new Date() })
      .where(eq(paymentWebhooks.eventId, parsed.eventId));
    return { status: 'IGNORED', paymentId: fresh.id };
  });
}

// ---------------------------------------------------------------------------
// Mock checkout — simulates the gateway capturing/failing and calling us back
// ---------------------------------------------------------------------------
export async function simulatePayment(
  customerUserId: string,
  gatewayOrderId: string,
  outcome: 'success' | 'fail',
) {
  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.gatewayOrderId, gatewayOrderId))
    .limit(1);
  if (!payment) throw new NotFoundError('Order not found');
  if (payment.customerUserId !== customerUserId) throw new ForbiddenError('Not your order');
  if (payment.status !== 'CREATED' && payment.status !== 'PENDING') {
    throw new ConflictError(`This order is already ${payment.status}`);
  }

  const gateway = getGateway();
  const gatewayPaymentId = mockPaymentId();
  const envelope = gateway.buildWebhook({
    eventType: outcome === 'success' ? 'payment.captured' : 'payment.failed',
    gatewayOrderId,
    gatewayPaymentId,
    amountPaise: payment.amountPaise,
    failureReason: outcome === 'fail' ? 'Simulated failure at gateway' : undefined,
  });

  // Server-to-server: hand the signed envelope to the very same verified path.
  const result = await processWebhook(envelope.body, envelope.signature);
  return { result, gatewayPaymentId, eventId: envelope.eventId };
}

// ---------------------------------------------------------------------------
// Verify payment — verifies the client checkout signature and applies success
// ---------------------------------------------------------------------------
export interface VerifyPaymentInput {
  gatewayOrderId: string;
  gatewayPaymentId: string;
  signature: string;
}

export async function verifyPayment(customerUserId: string, input: VerifyPaymentInput) {
  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.gatewayOrderId, input.gatewayOrderId))
    .limit(1);

  if (!payment) throw new NotFoundError('Payment order not found');
  if (payment.customerUserId !== customerUserId) throw new ForbiddenError('Not your payment order');

  if (payment.status === 'SUCCESS') {
    return {
      result: {
        status: 'ALREADY_FINAL' as const,
        paymentId: payment.id,
        paymentStatus: 'SUCCESS',
      },
    };
  }
  if (payment.status === 'FAILED') {
    return {
      result: {
        status: 'ALREADY_FINAL' as const,
        paymentId: payment.id,
        paymentStatus: 'FAILED',
      },
    };
  }

  const gateway = getGateway();
  const valid = gateway.verifyPaymentSignature({
    orderId: input.gatewayOrderId,
    paymentId: input.gatewayPaymentId,
    signature: input.signature,
  });

  if (!valid) {
    throw new UnauthorizedError('Invalid payment signature');
  }

  return db.transaction(async (tx) => {
    const [fresh] = await tx.select().from(payments).where(eq(payments.id, payment.id)).limit(1);
    if (fresh.status === 'SUCCESS' || fresh.status === 'FAILED') {
      return {
        result: {
          status: 'ALREADY_FINAL' as const,
          paymentId: fresh.id,
          paymentStatus: fresh.status,
        },
      };
    }

    const { cleared } = await completePaymentSuccessTx(tx, fresh, input.gatewayPaymentId);
    return {
      result: {
        status: 'PROCESSED' as const,
        paymentId: fresh.id,
        paymentStatus: 'SUCCESS',
        cleared,
      },
    };
  });
}

// ---------------------------------------------------------------------------
// Refund (merchant/admin) — reverses a repayment via a NEW ledger entry
// ---------------------------------------------------------------------------
export async function refundPayment(
  actor: { id: string; role: UserRole },
  paymentId: string,
  amountPaise: number,
  reason: string | undefined,
) {
  if (!Number.isInteger(amountPaise) || amountPaise <= 0) {
    throw new BadRequestError('Refund amount must be a positive integer in paise');
  }

  return db.transaction(async (tx) => {
    const [payment] = await tx.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
    if (!payment) throw new NotFoundError('Payment not found');

    // Only the shop that received it (or an admin) may refund.
    if (actor.role !== 'ADMIN') {
      const [m] = await tx.select().from(merchants).where(eq(merchants.id, payment.merchantId)).limit(1);
      if (!m || m.ownerUserId !== actor.id) throw new ForbiddenError('Not your payment to refund');
    }

    if (payment.status !== 'SUCCESS' && payment.status !== 'PARTIALLY_REFUNDED') {
      throw new ConflictError('Only a successful payment can be refunded');
    }
    const refundable = payment.amountPaise - payment.refundedPaise;
    if (amountPaise > refundable) throw new BadRequestError('Refund exceeds the refundable amount');

    const [row] = await tx.select().from(udhaar).where(eq(udhaar.id, payment.udhaarId)).limit(1);
    if (!row) throw new NotFoundError('Udhaar not found');

    const gateway = getGateway();
    const { gatewayRefundId } = await gateway.createRefund({
      gatewayPaymentId: payment.gatewayPaymentId ?? '',
      amountPaise,
    });

    // A refund gives money back to the customer → the repayment is reversed →
    // outstanding rises again. Recorded as a new REFUND ledger row (never an edit).
    const { balanceAfterPaise } = await postLedgerTransaction(tx, {
      accountId: row.accountId,
      udhaarId: row.id,
      type: 'REFUND',
      method: 'DIGITAL',
      amountPaise: amountPaise,
      description: `Refund of ${payment.ref}`,
      referenceType: 'refund',
      referenceId: payment.id,
      createdByUserId: actor.id,
    });

    const newOutstanding = row.outstandingPaise + amountPaise;
    await tx
      .update(udhaar)
      .set({
        outstandingPaise: newOutstanding,
        status: row.status === 'CLEARED' ? 'ACTIVE' : row.status,
        clearedAt: row.status === 'CLEARED' ? null : row.clearedAt,
        updatedAt: new Date(),
      })
      .where(eq(udhaar.id, row.id));

    // Record the refund on the immutable evidence timeline so the khata explains
    // why a cleared udhaar reverted to active. The ledger REFUND row above is the
    // financial source of truth; this is its human-readable evidence entry.
    await addRefundEvent(tx, {
      udhaarId: row.id,
      amountPaise,
      newOutstandingPaise: newOutstanding,
      paymentRef: payment.ref,
      paymentId: payment.id,
      actorUserId: actor.id,
      actorRole: actor.role,
    });

    const totalRefunded = payment.refundedPaise + amountPaise;
    await tx
      .update(payments)
      .set({
        refundedPaise: totalRefunded,
        status: totalRefunded >= payment.amountPaise ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
        updatedAt: new Date(),
      })
      .where(eq(payments.id, payment.id));

    const [refund] = await tx
      .insert(refunds)
      .values({
        paymentId: payment.id,
        udhaarId: row.id,
        amountPaise,
        reason,
        gatewayRefundId,
        status: 'SUCCESS',
        createdByUserId: actor.id,
      })
      .returning();

    const receipt = await createReceipt(tx, {
      type: 'REFUND',
      udhaarId: row.id,
      paymentId: payment.id,
      merchantId: payment.merchantId,
      customerUserId: payment.customerUserId,
      amountPaise,
      outstandingAfterPaise: newOutstanding,
      snapshot: { paymentRef: payment.ref, refundedPaise: amountPaise, reason, gatewayRefundId },
    });

    await tx.insert(settlements).values({
      merchantId: payment.merchantId,
      paymentId: payment.id,
      grossPaise: -amountPaise,
      feePaise: 0,
      netPaise: -amountPaise,
      status: 'PENDING',
      reference: `refund:${refund.id}`,
    });

    await notify(tx, {
      userId: payment.customerUserId,
      type: 'REFUND',
      title: 'Refund processed',
      body: `₹${(amountPaise / 100).toLocaleString('en-IN')} was refunded for ${payment.ref}`,
      data: { paymentId: payment.id, udhaarId: row.id },
    });

    await writeAudit(tx, {
      actorUserId: actor.id,
      actorRole: actor.role,
      action: 'PAYMENT_REFUNDED',
      entityType: 'payment',
      entityId: payment.id,
      summary: `Refunded ₹${(amountPaise / 100).toLocaleString('en-IN')} of ${payment.ref}`,
      metadata: { amountPaise, reason },
    });

    return { refund, receipt, balanceAfterPaise };
  });
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------
export async function getPayment(paymentId: string, requester: { id: string; role: UserRole }) {
  const [payment] = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
  if (!payment) throw new NotFoundError('Payment not found');

  const isCustomer = requester.role === 'CUSTOMER' && payment.customerUserId === requester.id;
  const isAdmin = requester.role === 'ADMIN';
  let isShop = false;
  if (requester.role === 'MERCHANT' || requester.role === 'STAFF') {
    const { resolveMerchantId } = await import('../merchants/service');
    const mid = await resolveMerchantId(requester.id, requester.role);
    isShop = mid === payment.merchantId;
  }
  if (!isCustomer && !isShop && !isAdmin) throw new ForbiddenError('You cannot view this payment');

  const refundRows = await db
    .select()
    .from(refunds)
    .where(eq(refunds.paymentId, paymentId))
    .orderBy(desc(refunds.createdAt));

  return { payment, refunds: refundRows };
}

export async function listPaymentsForUdhaar(udhaarId: string) {
  return db
    .select()
    .from(payments)
    .where(eq(payments.udhaarId, udhaarId))
    .orderBy(desc(payments.createdAt));
}
