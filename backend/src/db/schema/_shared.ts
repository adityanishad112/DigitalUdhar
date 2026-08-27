import { bigint, text, timestamp } from 'drizzle-orm/pg-core';
import { newId } from '../../core/ids';

/** Application-generated UUID primary key. */
export const pk = () => text('id').primaryKey().$defaultFn(() => newId());

/** created_at / updated_at pair. */
export const timestamps = () => ({
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

/** Money column (integer paise, stored as bigint for headroom). */
export const money = (name: string) => bigint(name, { mode: 'number' });
