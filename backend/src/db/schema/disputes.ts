import { index, jsonb, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { money, pk, timestamps } from './_shared';
import { merchants } from './merchants';
import { udhaar } from './udhaar';
import { users } from './users';
import type { DisputeCategory, DisputeStatus } from './enums';

export const disputes = pgTable(
  'disputes',
  {
    id: pk(),
    ref: text('ref').notNull(),
    udhaarId: text('udhaar_id')
      .notNull()
      .references(() => udhaar.id, { onDelete: 'restrict' }),
    raisedByUserId: text('raised_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    merchantId: text('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    category: text('category').$type<DisputeCategory>().notNull(),
    status: text('status').$type<DisputeStatus>().notNull().default('OPEN'),
    description: text('description'),
    amountClaimedPaise: money('amount_claimed_paise'),
    resolution: text('resolution'),
    resolvedByUserId: text('resolved_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('disputes_ref_uq').on(t.ref),
    index('disputes_udhaar_idx').on(t.udhaarId),
    index('disputes_status_idx').on(t.status),
  ],
);

export const disputeEvidence = pgTable(
  'dispute_evidence',
  {
    id: pk(),
    disputeId: text('dispute_id')
      .notNull()
      .references(() => disputes.id, { onDelete: 'cascade' }),
    addedByUserId: text('added_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    addedByRole: text('added_by_role'),
    kind: text('kind').$type<'NOTE' | 'FILE' | 'SYSTEM'>().notNull().default('NOTE'),
    text: text('text'),
    fileUrl: text('file_url'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('dispute_evidence_dispute_idx').on(t.disputeId)],
);

/**
 * An adjustment never edits the original transaction — it records a correction
 * (signed amount) and creates its own ledger_transactions row.
 */
export const adjustments = pgTable(
  'adjustments',
  {
    id: pk(),
    udhaarId: text('udhaar_id')
      .notNull()
      .references(() => udhaar.id, { onDelete: 'restrict' }),
    accountId: text('account_id').notNull(),
    amountPaise: money('amount_paise').notNull(), // signed
    reason: text('reason').notNull(),
    referenceTxnId: text('reference_txn_id'),
    disputeId: text('dispute_id'),
    createdByUserId: text('created_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('adjustments_udhaar_idx').on(t.udhaarId)],
);
