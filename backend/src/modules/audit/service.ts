import { desc, eq } from 'drizzle-orm';
import type { DB, Tx } from '../../db/client';
import { db } from '../../db/client';
import { auditLogs } from '../../db/schema';

export type Exec = DB | Tx;

export interface AuditInput {
  actorUserId?: string | null;
  actorRole?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  summary?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
}

/** Append an audit-log entry. Every admin financial action must call this. */
export async function writeAudit(exec: Exec, input: AuditInput): Promise<void> {
  await (exec as DB).insert(auditLogs).values({
    actorUserId: input.actorUserId ?? null,
    actorRole: input.actorRole ?? null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    summary: input.summary,
    metadata: input.metadata,
    ip: input.ip,
  });
}

export async function listAuditLogs(limit = 200) {
  return db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(limit);
}

export async function listAuditForEntity(entityType: string, entityId: string) {
  return db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.entityId, entityId))
    .orderBy(desc(auditLogs.createdAt));
}
