import { and, desc, eq, inArray, lt } from 'drizzle-orm';
import { db } from '../../db/client';
import {
  merchants,
  promiseToPay,
  reminders,
  udhaar,
  udhaarEvents,
  users,
} from '../../db/schema';
import type { ReminderType, UserRole } from '../../db/schema/enums';
import { notify } from '../notifications/service';
import { resolveMerchantId } from '../merchants/service';

const DAY = 24 * 60 * 60 * 1000;
const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const daysUntil = (due: Date) =>
  Math.round((startOfDay(due).getTime() - startOfDay(new Date()).getTime()) / DAY);

const inr = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN')}`;

/** Which reminder (if any) is warranted today for an udhaar at this due-distance. */
function reminderTypeFor(days: number): ReminderType | null {
  if (days === 3) return 'BEFORE_3D';
  if (days === 1) return 'BEFORE_1D';
  if (days === 0) return 'DUE_DATE';
  if (days === -1) return 'OVERDUE_1D';
  if (days === -3) return 'OVERDUE_3D';
  if (days <= -7 && days % 7 === 0) return 'OVERDUE_WEEKLY';
  return null;
}

function reminderCopy(type: ReminderType, ref: string, outstandingPaise: number) {
  const amt = inr(outstandingPaise);
  switch (type) {
    case 'BEFORE_3D':
      return { title: 'Payment due in 3 days', body: `${amt} for ${ref} is due in 3 days.` };
    case 'BEFORE_1D':
      return { title: 'Payment due tomorrow', body: `${amt} for ${ref} is due tomorrow.` };
    case 'DUE_DATE':
      return { title: 'Payment due today', body: `${amt} for ${ref} is due today.` };
    case 'OVERDUE_1D':
      return { title: 'Payment overdue', body: `${amt} for ${ref} is 1 day overdue.` };
    case 'OVERDUE_3D':
      return { title: 'Payment overdue', body: `${amt} for ${ref} is 3 days overdue.` };
    case 'OVERDUE_WEEKLY':
      return { title: 'Payment still pending', body: `${amt} for ${ref} is still unpaid.` };
  }
}

export interface SweepResult {
  remindersCreated: number;
  promisesMissed: number;
}

/**
 * Idempotent daily sweep. For each active, unpaid udhaar it emits at most one
 * reminder per (udhaar, type). Also flips pending promises whose date has passed
 * to MISSED. Safe to run repeatedly (e.g. hourly cron) — deduped by type.
 */
export async function runCollectionsSweep(): Promise<SweepResult> {
  let remindersCreated = 0;
  let promisesMissed = 0;

  // --- Reminders for active, unpaid udhaar -------------------------------
  const active = await db
    .select()
    .from(udhaar)
    .where(eq(udhaar.status, 'ACTIVE'));

  for (const row of active) {
    if (row.outstandingPaise <= 0) continue;
    const type = reminderTypeFor(daysUntil(row.dueDate));
    if (!type) continue;

    // Dedup: skip if a reminder of this type already exists for this udhaar.
    const [existing] = await db
      .select({ id: reminders.id })
      .from(reminders)
      .where(and(eq(reminders.udhaarId, row.id), eq(reminders.type, type)))
      .limit(1);
    if (existing) continue;

    await db.transaction(async (tx) => {
      await tx.insert(reminders).values({
        udhaarId: row.id,
        customerUserId: row.customerUserId,
        merchantId: row.merchantId,
        type,
        scheduledAt: new Date(),
        status: 'SENT',
        sentAt: new Date(),
      });

      const copy = reminderCopy(type, row.ref, row.outstandingPaise);
      await notify(tx, {
        userId: row.customerUserId,
        type: 'REMINDER',
        title: copy.title,
        body: copy.body,
        data: { udhaarId: row.id, ref: row.ref, reminderType: type },
      });
    });
    remindersCreated += 1;
  }

  // --- Promises whose date has passed → MISSED ---------------------------
  const overduePromises = await db
    .select()
    .from(promiseToPay)
    .where(and(eq(promiseToPay.status, 'PENDING'), lt(promiseToPay.promisedDate, startOfDay(new Date()))));

  for (const p of overduePromises) {
    // Only mark missed if the udhaar is still active & unpaid.
    const [row] = await db.select().from(udhaar).where(eq(udhaar.id, p.udhaarId)).limit(1);
    if (!row || row.status !== 'ACTIVE' || row.outstandingPaise <= 0) {
      // Stale promise on a cleared/closed udhaar — cancel quietly.
      await db
        .update(promiseToPay)
        .set({ status: 'CANCELLED', updatedAt: new Date() })
        .where(eq(promiseToPay.id, p.id));
      continue;
    }

    await db.transaction(async (tx) => {
      await tx
        .update(promiseToPay)
        .set({ status: 'MISSED', missedAt: new Date(), updatedAt: new Date() })
        .where(eq(promiseToPay.id, p.id));

      await tx.insert(udhaarEvents).values({
        udhaarId: row.id,
        type: 'PROMISE_MISSED',
        title: 'Promise missed',
        description: `Promised ${inr(p.amountPaise)} by ${p.promisedDate.toLocaleDateString('en-IN')} — not received.`,
        amountPaise: p.amountPaise,
        actorRole: 'SYSTEM',
      });

      const [m] = await tx.select().from(merchants).where(eq(merchants.id, row.merchantId)).limit(1);
      // Notify both parties.
      await notify(tx, {
        userId: row.customerUserId,
        type: 'PROMISE_MISSED',
        title: 'Promise missed',
        body: `Your promise to pay ${inr(p.amountPaise)} for ${row.ref} has passed.`,
        data: { udhaarId: row.id, ref: row.ref },
      });
      if (m) {
        await notify(tx, {
          userId: m.ownerUserId,
          type: 'PROMISE_MISSED',
          title: 'Promise missed',
          body: `A promise of ${inr(p.amountPaise)} for ${row.ref} was not kept.`,
          data: { udhaarId: row.id, ref: row.ref },
        });
      }
    });
    promisesMissed += 1;
  }

  return { remindersCreated, promisesMissed };
}

/** Reminders visible to the requester (their own, as customer or shop). */
export async function listReminders(requester: { id: string; role: UserRole }) {
  if (requester.role === 'CUSTOMER') {
    return db
      .select()
      .from(reminders)
      .where(eq(reminders.customerUserId, requester.id))
      .orderBy(desc(reminders.createdAt))
      .limit(100);
  }
  if (requester.role === 'MERCHANT' || requester.role === 'STAFF') {
    const mid = await resolveMerchantId(requester.id, requester.role);
    if (!mid) return [];
    return db
      .select()
      .from(reminders)
      .where(eq(reminders.merchantId, mid))
      .orderBy(desc(reminders.createdAt))
      .limit(100);
  }
  return [];
}

void inArray;
void users;
