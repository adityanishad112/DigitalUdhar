import { boolean, index, jsonb, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { money, pk, timestamps } from './_shared';
import { ledgerAccounts } from './ledger';
import { merchants } from './merchants';
import { users } from './users';
import type { PromiseStatus, UdhaarStatus } from './enums';

export interface UdhaarItem {
  name: string;
  qty?: number;
  pricePaise?: number;
}

export const udhaar = pgTable(
  'udhaar',
  {
    id: pk(),
    ref: text('ref').notNull(),
    accountId: text('account_id')
      .notNull()
      .references(() => ledgerAccounts.id, { onDelete: 'restrict' }),
    merchantId: text('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    customerUserId: text('customer_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdByUserId: text('created_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    principalPaise: money('principal_paise').notNull(),
    outstandingPaise: money('outstanding_paise').notNull(),
    status: text('status').$type<UdhaarStatus>().notNull().default('REQUESTED'),
    items: jsonb('items').$type<UdhaarItem[]>(),
    note: text('note'),
    billRef: text('bill_ref'),
    dueDate: timestamp('due_date', { withTimezone: true }).notNull(),
    customerConfirmed: boolean('customer_confirmed').notNull().default(true),
    merchantConfirmed: boolean('merchant_confirmed').notNull().default(false),
    limitExceeded: boolean('limit_exceeded').notNull().default(false),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    rejectedAt: timestamp('rejected_at', { withTimezone: true }),
    rejectedReason: text('rejected_reason'),
    clearedAt: timestamp('cleared_at', { withTimezone: true }),
    disputedAt: timestamp('disputed_at', { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('udhaar_ref_uq').on(t.ref),
    index('udhaar_merchant_idx').on(t.merchantId),
    index('udhaar_customer_idx').on(t.customerUserId),
    index('udhaar_account_idx').on(t.accountId),
    index('udhaar_status_idx').on(t.status),
  ],
);

export const udhaarEvents = pgTable(
  'udhaar_events',
  {
    id: pk(),
    udhaarId: text('udhaar_id')
      .notNull()
      .references(() => udhaar.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    actorUserId: text('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    actorRole: text('actor_role'),
    title: text('title').notNull(),
    description: text('description'),
    amountPaise: money('amount_paise'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('udhaar_events_udhaar_idx').on(t.udhaarId)],
);

export const promiseToPay = pgTable(
  'promise_to_pay',
  {
    id: pk(),
    udhaarId: text('udhaar_id')
      .notNull()
      .references(() => udhaar.id, { onDelete: 'cascade' }),
    customerUserId: text('customer_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    promisedDate: timestamp('promised_date', { withTimezone: true }).notNull(),
    amountPaise: money('amount_paise').notNull(),
    status: text('status').$type<PromiseStatus>().notNull().default('PENDING'),
    note: text('note'),
    fulfilledAt: timestamp('fulfilled_at', { withTimezone: true }),
    missedAt: timestamp('missed_at', { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [index('promise_udhaar_idx').on(t.udhaarId)],
);
