import { index, integer, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { money, pk, timestamps } from './_shared';
import { merchants } from './merchants';
import { users } from './users';

export const products = pgTable(
  'products',
  {
    id: pk(),
    merchantId: text('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    sku: text('sku'),
    name: text('name').notNull(),
    category: text('category'),
    purchasePricePaise: money('purchase_price_paise'),
    sellingPricePaise: money('selling_price_paise').notNull().default(0),
    stock: integer('stock').notNull().default(0),
    lowStockThreshold: integer('low_stock_threshold').notNull().default(0),
    taxPercent: integer('tax_percent').notNull().default(0),
    status: text('status').$type<'ACTIVE' | 'INACTIVE'>().notNull().default('ACTIVE'),
    ...timestamps(),
  },
  (t) => [
    index('products_merchant_idx').on(t.merchantId),
    uniqueIndex('products_sku_uq').on(t.merchantId, t.sku),
  ],
);

export const invoices = pgTable(
  'invoices',
  {
    id: pk(),
    invoiceNo: text('invoice_no').notNull(),
    merchantId: text('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    customerUserId: text('customer_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    customerName: text('customer_name'),
    subtotalPaise: money('subtotal_paise').notNull().default(0),
    discountPaise: money('discount_paise').notNull().default(0),
    taxPaise: money('tax_paise').notNull().default(0),
    totalPaise: money('total_paise').notNull().default(0),
    paidPaise: money('paid_paise').notNull().default(0),
    udhaarPaise: money('udhaar_paise').notNull().default(0),
    udhaarId: text('udhaar_id'),
    status: text('status')
      .$type<'DRAFT' | 'ISSUED' | 'PAID' | 'PARTIAL'>()
      .notNull()
      .default('ISSUED'),
    notes: text('notes'),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('invoices_no_uq').on(t.invoiceNo),
    index('invoices_merchant_idx').on(t.merchantId),
  ],
);

export const invoiceItems = pgTable(
  'invoice_items',
  {
    id: pk(),
    invoiceId: text('invoice_id')
      .notNull()
      .references(() => invoices.id, { onDelete: 'cascade' }),
    productId: text('product_id'),
    name: text('name').notNull(),
    qty: integer('qty').notNull().default(1),
    unitPricePaise: money('unit_price_paise').notNull().default(0),
    discountPaise: money('discount_paise').notNull().default(0),
    taxPercent: integer('tax_percent').notNull().default(0),
    lineTotalPaise: money('line_total_paise').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('invoice_items_invoice_idx').on(t.invoiceId)],
);
