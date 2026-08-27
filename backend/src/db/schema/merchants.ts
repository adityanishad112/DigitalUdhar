import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { money, pk, timestamps } from './_shared';
import { users } from './users';
import type { MerchantStatus, QrStatus, StaffPermission } from './enums';

export const merchants = pgTable(
  'merchants',
  {
    id: pk(),
    ownerUserId: text('owner_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    shopName: text('shop_name').notNull(),
    legalName: text('legal_name'),
    category: text('category'),
    description: text('description'),
    address: text('address'),
    city: text('city'),
    state: text('state'),
    pincode: text('pincode'),
    phone: text('phone'),
    email: text('email'),
    upiId: text('upi_id'),
    gstin: text('gstin'),
    status: text('status').$type<MerchantStatus>().notNull().default('ACTIVE'),
    // Defaults applied to new customer relationships.
    defaultCreditLimitPaise: money('default_credit_limit_paise').notNull().default(500000),
    defaultTermsDays: integer('default_terms_days').notNull().default(15),
    defaultMaxTxnPaise: money('default_max_txn_paise').notNull().default(200000),
    ...timestamps(),
  },
  (t) => [index('merchants_owner_idx').on(t.ownerUserId)],
);

export const merchantStaff = pgTable(
  'merchant_staff',
  {
    id: pk(),
    merchantId: text('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    permissions: jsonb('permissions').$type<StaffPermission[]>().notNull().default([]),
    status: text('status').$type<'ACTIVE' | 'REVOKED'>().notNull().default('ACTIVE'),
    ...timestamps(),
  },
  (t) => [uniqueIndex('merchant_staff_uq').on(t.merchantId, t.userId)],
);

export const merchantCustomers = pgTable(
  'merchant_customers',
  {
    id: pk(),
    merchantId: text('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    customerUserId: text('customer_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    displayName: text('display_name'),
    // Per-relationship overrides; null falls back to the merchant defaults.
    creditLimitPaise: money('credit_limit_paise'),
    termsDays: integer('terms_days'),
    maxTxnPaise: money('max_txn_paise'),
    status: text('status').$type<'ACTIVE' | 'BLOCKED'>().notNull().default('ACTIVE'),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('merchant_customer_uq').on(t.merchantId, t.customerUserId),
    index('merchant_customer_cust_idx').on(t.customerUserId),
  ],
);

export const qrCodes = pgTable(
  'qr_codes',
  {
    id: pk(),
    merchantId: text('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    token: text('token').notNull(),
    label: text('label'),
    status: text('status').$type<QrStatus>().notNull().default('ACTIVE'),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('qr_token_uq').on(t.token),
    index('qr_merchant_idx').on(t.merchantId),
  ],
);
