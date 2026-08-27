import { and, desc, eq, gte, inArray } from 'drizzle-orm';
import { db } from '../../db/client';
import {
  ledgerAccounts,
  ledgerTransactions,
  merchantCustomers,
  udhaar,
  users,
} from '../../db/schema';

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const startOfMonth = () => {
  const x = new Date();
  x.setDate(1);
  x.setHours(0, 0, 0, 0);
  return x;
};

/**
 * Merchant analytics computed purely from the ledger + udhaar tables — no AI,
 * no scoring models, just deterministic SQL/JS aggregation. All money in paise.
 */
export async function getMerchantReport(merchantId: string) {
  const accounts = await db
    .select()
    .from(ledgerAccounts)
    .where(eq(ledgerAccounts.merchantId, merchantId));

  const totalOutstandingPaise = accounts.reduce((s, a) => s + a.balancePaise, 0);
  const totalUdhaarPaise = accounts.reduce((s, a) => s + a.totalUdhaarPaise, 0);
  const totalRepaidPaise = accounts.reduce((s, a) => s + a.totalRepaidPaise, 0);

  const rows = await db.select().from(udhaar).where(eq(udhaar.merchantId, merchantId));
  const today = startOfDay(new Date()).getTime();

  const counts = {
    total: rows.length,
    requested: 0,
    active: 0,
    cleared: 0,
    rejected: 0,
    disputed: 0,
    overdue: 0,
    dueToday: 0,
  };
  let overdueAmountPaise = 0;
  for (const r of rows) {
    if (r.status === 'REQUESTED') counts.requested += 1;
    else if (r.status === 'ACTIVE') counts.active += 1;
    else if (r.status === 'CLEARED') counts.cleared += 1;
    else if (r.status === 'REJECTED') counts.rejected += 1;
    else if (r.status === 'DISPUTED') counts.disputed += 1;

    if (r.status === 'ACTIVE' && r.outstandingPaise > 0) {
      const due = startOfDay(r.dueDate).getTime();
      if (due < today) {
        counts.overdue += 1;
        overdueAmountPaise += r.outstandingPaise;
      } else if (due === today) {
        counts.dueToday += 1;
      }
    }
  }

  // Collections this month (sum of repayments, which are negative in the ledger).
  const accountIds = accounts.map((a) => a.id);
  let collectionsThisMonthPaise = 0;
  if (accountIds.length) {
    const txns = await db
      .select()
      .from(ledgerTransactions)
      .where(
        and(
          inArray(ledgerTransactions.accountId, accountIds),
          eq(ledgerTransactions.type, 'REPAYMENT'),
          gte(ledgerTransactions.createdAt, startOfMonth()),
        ),
      );
    collectionsThisMonthPaise = txns.reduce((s, t) => s + Math.abs(t.amountPaise), 0);
  }

  // Top debtors (customers who owe the most right now).
  const debtorRows = accounts
    .filter((a) => a.balancePaise > 0)
    .sort((a, b) => b.balancePaise - a.balancePaise)
    .slice(0, 5);
  const debtorUserIds = debtorRows.map((a) => a.customerUserId);
  const debtorUsers = debtorUserIds.length
    ? await db
        .select({ id: users.id, name: users.name, mobile: users.mobile })
        .from(users)
        .where(inArray(users.id, debtorUserIds))
    : [];
  const nameById = new Map(debtorUsers.map((u) => [u.id, u]));
  const topDebtors = debtorRows.map((a) => ({
    customerUserId: a.customerUserId,
    name: nameById.get(a.customerUserId)?.name ?? 'Customer',
    mobile: nameById.get(a.customerUserId)?.mobile ?? null,
    outstandingPaise: a.balancePaise,
  }));

  const [{ count: customerCount } = { count: 0 }] = [
    { count: (await db.select().from(merchantCustomers).where(eq(merchantCustomers.merchantId, merchantId))).length },
  ];

  const collectionRatePct =
    totalUdhaarPaise > 0 ? Math.round((totalRepaidPaise / totalUdhaarPaise) * 100) : 0;

  return {
    totalOutstandingPaise,
    totalUdhaarPaise,
    totalRepaidPaise,
    collectionsThisMonthPaise,
    overdueAmountPaise,
    collectionRatePct,
    customerCount,
    counts,
    topDebtors,
  };
}

/** A simple ledger-backed activity feed for the merchant dashboard. */
export async function getMerchantActivity(merchantId: string, limit = 20) {
  const accounts = await db
    .select({ id: ledgerAccounts.id })
    .from(ledgerAccounts)
    .where(eq(ledgerAccounts.merchantId, merchantId));
  const accountIds = accounts.map((a) => a.id);
  if (!accountIds.length) return [];
  return db
    .select()
    .from(ledgerTransactions)
    .where(inArray(ledgerTransactions.accountId, accountIds))
    .orderBy(desc(ledgerTransactions.createdAt))
    .limit(limit);
}
