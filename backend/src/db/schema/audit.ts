import { index, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { pk } from './_shared';
import { users } from './users';

/**
 * Append-only audit trail. Every admin financial action and every sensitive
 * state change is recorded here.
 */
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: pk(),
    actorUserId: text('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    actorRole: text('actor_role'),
    action: text('action').notNull(),
    entityType: text('entity_type'),
    entityId: text('entity_id'),
    summary: text('summary'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    ip: text('ip'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('audit_actor_idx').on(t.actorUserId),
    index('audit_entity_idx').on(t.entityType, t.entityId),
    index('audit_created_idx').on(t.createdAt),
  ],
);
