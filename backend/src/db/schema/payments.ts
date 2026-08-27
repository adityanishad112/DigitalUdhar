import { index, jsonb, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { money, pk, timestamps } from './_shared';
import { merchants } from './merchants';
import { users } from './users';
import { udhaar } from './udhaar';
import type {
  PaymentMethod,
  PaymentStatus,
  ReceiptType,
  SettlementStatus,
} from './enums';

export const payments = pgTable(
  'payments',
  {
    id: pk(),
    ref: text('ref').notNull(),
    udhaarId: text('udhaar_id')
      .notNull()
      .references(() => udhaar.id, { onDelete: 'restrict' }),
    merchantId: text('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    customerUserId: text('customer_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    amountPaise: money('amount_paise').notNull(),
    method: text('method').$type<PaymentMethod>().notNull().default('UPI'),
    status: text('status').$type<PaymentStatus>().notNull().default('CREATED'),
    idempotencyKey: text('idempotency_key').notNull(),
    gatewayProvider: text('gateway_provider').notNull().default('mock'),
    gatewayOrderId: text('gateway_order_id'),
    gatewayPaymentId: text('gateway_payment_id'),
    feePaise: money('fee_paise').notNull().default(0),
    netPaise: money('net_paise').notNull().default(0),
    refundedPaise: money('refunded_paise').notNull().default(0),
    failureReason: text('failure_reason'),
    initiatedByUserId: text('initiated_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('payments_ref_uq').on(t.ref),
    uniqueIndex('payments_idempotency_uq').on(t.idempotencyKey),
    index('payments_udhaar_idx').on(t.udhaarId),
    index('payments_merchant_idx').on(t.merchantId),
    index('payments_customer_idx').on(t.customerUserId),
  ],
);

export const paymentOrders = pgTable(
  'payment_orders',
  {
    id: pk(),
    paymentId: text('payment_id')
      .notNull()
      .references(() => payments.id, { onDelete: 'cascade' }),
    gatewayOrderId: text('gateway_order_id').notNull(),
    amountPaise: money('amount_paise').notNull(),
    currency: text('currency').notNull().default('INR'),
    status: text('status').$type<'CREATED' | 'PAID' | 'FAILED'>().notNull().default('CREATED'),
    ...timestamps(),
  },
  (t) => [uniqueIndex('payment_orders_gwid_uq').on(t.gatewayOrderId)],
);

/**
 * Every inbound webhook is recorded here first. The unique eventId guarantees
 * idempotency — a duplicate delivery is detected and ignored, never re-applied.
 */
export const paymentWebhooks = pgTable(
  'payment_webhooks',
  {
    id: pk(),
    eventId: text('event_id').notNull(),
    provider: text('provider').notNull().default('mock'),
    eventType: text('event_type').notNull(),
    paymentId: text('payment_id'),
    gatewayOrderId: text('gateway_order_id'),
    gatewayPaymentId: text('gateway_payment_id'),
    signature: text('signature'),
    payload: jsonb('payload').$type<Record<string, unknown>>(),
    status: text('status')
      .$type<'RECEIVED' | 'PROCESSED' | 'INVALID_SIGNATURE' | 'DUPLICATE' | 'IGNORED'>()
      .notNull()
      .default('RECEIVED'),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('payment_webhooks_event_uq').on(t.eventId)],
);

export const refunds = pgTable(
  'refunds',
  {
    id: pk(),
    paymentId: text('payment_id')
      .notNull()
      .references(() => payments.id, { onDelete: 'restrict' }),
    udhaarId: text('udhaar_id'),
    amountPaise: money('amount_paise').notNull(),
    reason: text('reason'),
    gatewayRefundId: text('gateway_refund_id'),
    status: text('status').$type<'PENDING' | 'SUCCESS' | 'FAILED'>().notNull().default('PENDING'),
    createdByUserId: text('created_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    ...timestamps(),
  },
  (t) => [index('refunds_payment_idx').on(t.paymentId)],
);

export const receipts = pgTable(
  'receipts',
  {
    id: pk(),
    receiptNo: text('receipt_no').notNull(),
    type: text('type').$type<ReceiptType>().notNull(),
    udhaarId: text('udhaar_id'),
    paymentId: text('payment_id'),
    merchantId: text('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    customerUserId: text('customer_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    amountPaise: money('amount_paise').notNull(),
    outstandingAfterPaise: money('outstanding_after_paise').notNull(),
    method: text('method'),
    // Immutable snapshot of everything shown on the receipt at generation time.
    snapshot: jsonb('snapshot').$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('receipts_no_uq').on(t.receiptNo),
    index('receipts_udhaar_idx').on(t.udhaarId),
    index('receipts_customer_idx').on(t.customerUserId),
  ],
);

export const settlements = pgTable(
  'settlements',
  {
    id: pk(),
    merchantId: text('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    paymentId: text('payment_id'),
    grossPaise: money('gross_paise').notNull(),
    feePaise: money('fee_paise').notNull().default(0),
    netPaise: money('net_paise').notNull(),
    status: text('status').$type<SettlementStatus>().notNull().default('PENDING'),
    reference: text('reference'),
    settledAt: timestamp('settled_at', { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [index('settlements_merchant_idx').on(t.merchantId)],
);
