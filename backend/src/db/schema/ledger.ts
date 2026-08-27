import { index, jsonb, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { money, pk, timestamps } from './_shared';
import { merchants } from './merchants';
import { users } from './users';
import type { LedgerMethod, LedgerTxnType } from './enums';

/**
 * A ledger account is the running "khata" between one merchant and one customer.
 * balancePaise is the cached outstanding (positive = the customer owes the shop).
 * It is always updated together with a ledger_transactions row inside the same
 * DB transaction, and can be recomputed from the transaction log at any time.
 */
export const ledgerAccounts = pgTable(
  'ledger_accounts',
  {
    id: pk(),
    merchantId: text('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    customerUserId: text('customer_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    balancePaise: money('balance_paise').notNull().default(0),
    totalUdhaarPaise: money('total_udhaar_paise').notNull().default(0),
    totalRepaidPaise: money('total_repaid_paise').notNull().default(0),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('ledger_account_uq').on(t.merchantId, t.customerUserId),
    index('ledger_account_customer_idx').on(t.customerUserId),
  ],
);

/**
 * Append-only financial journal. Rows are NEVER updated or deleted.
 * amountPaise is signed: positive increases outstanding (udhaar / positive
 * adjustment), negative decreases it (repayment / refund / negative adjustment).
 */
export const ledgerTransactions = pgTable(
  'ledger_transactions',
  {
    id: pk(),
    accountId: text('account_id')
      .notNull()
      .references(() => ledgerAccounts.id, { onDelete: 'restrict' }),
    // Logical link to an udhaar (no hard FK to avoid a schema import cycle).
    udhaarId: text('udhaar_id'),
    type: text('type').$type<LedgerTxnType>().notNull(),
    method: text('method').$type<LedgerMethod>().notNull().default('SYSTEM'),
    amountPaise: money('amount_paise').notNull(),
    balanceAfterPaise: money('balance_after_paise').notNull(),
    description: text('description'),
    referenceType: text('reference_type'),
    referenceId: text('reference_id'),
    createdByUserId: text('created_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('ledger_txn_account_idx').on(t.accountId),
    index('ledger_txn_udhaar_idx').on(t.udhaarId),
  ],
);
