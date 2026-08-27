import { boolean, index, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { pk } from './_shared';
import { merchants } from './merchants';
import { udhaar } from './udhaar';
import { users } from './users';
import type { NotificationType, ReminderStatus, ReminderType } from './enums';

export const reminders = pgTable(
  'reminders',
  {
    id: pk(),
    udhaarId: text('udhaar_id')
      .notNull()
      .references(() => udhaar.id, { onDelete: 'cascade' }),
    customerUserId: text('customer_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    merchantId: text('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    type: text('type').$type<ReminderType>().notNull(),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
    status: text('status').$type<ReminderStatus>().notNull().default('SCHEDULED'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('reminders_due_idx').on(t.scheduledAt, t.status),
    index('reminders_udhaar_idx').on(t.udhaarId),
  ],
);

export const notifications = pgTable(
  'notifications',
  {
    id: pk(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').$type<NotificationType>().notNull(),
    title: text('title').notNull(),
    body: text('body'),
    data: jsonb('data').$type<Record<string, unknown>>(),
    read: boolean('read').notNull().default(false),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('notifications_user_idx').on(t.userId, t.read)],
);
