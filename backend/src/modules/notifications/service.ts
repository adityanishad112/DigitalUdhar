import { and, desc, eq } from 'drizzle-orm';
import type { DB, Tx } from '../../db/client';
import { db } from '../../db/client';
import { notifications } from '../../db/schema';
import type { NotificationType } from '../../db/schema/enums';

export type Exec = DB | Tx;

export interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
}

/** Create an in-app notification. Safe to call inside a transaction. */
export async function notify(exec: Exec, input: NotifyInput): Promise<void> {
  await (exec as DB).insert(notifications).values({
    userId: input.userId,
    type: input.type,
    title: input.title,
    body: input.body,
    data: input.data,
  });
}

export async function listNotifications(userId: string, onlyUnread = false) {
  const where = onlyUnread
    ? and(eq(notifications.userId, userId), eq(notifications.read, false))
    : eq(notifications.userId, userId);
  return db.select().from(notifications).where(where).orderBy(desc(notifications.createdAt)).limit(100);
}

export async function markRead(userId: string, id: string): Promise<void> {
  await db
    .update(notifications)
    .set({ read: true, readAt: new Date() })
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
}

export async function markAllRead(userId: string): Promise<void> {
  await db
    .update(notifications)
    .set({ read: true, readAt: new Date() })
    .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));
}

export async function unreadCount(userId: string): Promise<number> {
  const rows = await db
    .select()
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));
  return rows.length;
}
