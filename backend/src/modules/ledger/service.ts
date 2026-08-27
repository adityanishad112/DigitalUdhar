import { and, eq, sql } from 'drizzle-orm';
import type { DB, Tx } from '../../db/client';
import { db } from '../../db/client';
import { ledgerAccounts, ledgerTransactions } from '../../db/schema';
import type { LedgerMethod, LedgerTxnType } from '../../db/schema/enums';

export type LedgerAccount = typeof ledgerAccounts.$inferSelect;
export type LedgerTransaction = typeof ledgerTransactions.$inferSelect;

export async function getOrCreateAccount(
  tx: Tx,
  merchantId: string,
  customerUserId: string,
): Promise<LedgerAccount> {
  const existing = await tx
    .select()
    .from(ledgerAccounts)
    .where(
      and(
        eq(ledgerAccounts.merchantId, merchantId),
        eq(ledgerAccounts.customerUserId, customerUserId),
      ),
    )
    .limit(1);
  if (existing[0]) return existing[0];

  const [created] = await tx
    .insert(ledgerAccounts)
    .values({ merchantId, customerUserId })
    .returning();
  return created;
}

export interface PostLedgerParams {
  accountId: string;
  udhaarId?: string | null;
  type: LedgerTxnType;
  method?: LedgerMethod;
  /** Signed paise: + increases outstanding, - decreases it. */
  amountPaise: number;
  description?: string;
  referenceType?: string;
  referenceId?: string;
  createdByUserId?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * The single choke-point for every financial mutation. Appends an immutable
 * ledger_transactions row and updates the account's cached balance atomically.
 * MUST be called inside a db.transaction so the row + balance move together.
 */
export async function postLedgerTransaction(
  tx: Tx,
  params: PostLedgerParams,
): Promise<{ transaction: LedgerTransaction; balanceAfterPaise: number }> {
  const [account] = await tx
    .select()
    .from(ledgerAccounts)
    .where(eq(ledgerAccounts.id, params.accountId))
    .limit(1);
  if (!account) throw new Error(`Ledger account not found: ${params.accountId}`);

  const balanceAfterPaise = account.balancePaise + params.amountPaise;
  if (balanceAfterPaise < 0) {
    // Guards against over-repayment / bad adjustments driving a khata negative.
    throw new Error('Ledger operation would drive the balance below zero');
  }

  const [transaction] = await tx
    .insert(ledgerTransactions)
    .values({
      accountId: params.accountId,
      udhaarId: params.udhaarId ?? null,
      type: params.type,
      method: params.method ?? 'SYSTEM',
      amountPaise: params.amountPaise,
      balanceAfterPaise,
      description: params.description,
      referenceType: params.referenceType,
      referenceId: params.referenceId,
      createdByUserId: params.createdByUserId ?? null,
      metadata: params.metadata,
    })
    .returning();

  const totalsPatch: Record<string, unknown> = {
    balancePaise: balanceAfterPaise,
    updatedAt: new Date(),
  };
  if (params.type === 'UDHAAR_CREATED' && params.amountPaise > 0) {
    totalsPatch.totalUdhaarPaise = sql`${ledgerAccounts.totalUdhaarPaise} + ${params.amountPaise}`;
  }
  if (params.type === 'REPAYMENT' && params.amountPaise < 0) {
    totalsPatch.totalRepaidPaise = sql`${ledgerAccounts.totalRepaidPaise} + ${-params.amountPaise}`;
  }

  await tx.update(ledgerAccounts).set(totalsPatch).where(eq(ledgerAccounts.id, params.accountId));

  return { transaction, balanceAfterPaise };
}

/** Recompute the outstanding balance from the immutable log (used by tests/audits). */
export async function recomputeAccountBalance(
  exec: DB,
  accountId: string,
): Promise<number> {
  const [row] = await exec
    .select({ total: sql<number>`coalesce(sum(${ledgerTransactions.amountPaise}), 0)` })
    .from(ledgerTransactions)
    .where(eq(ledgerTransactions.accountId, accountId));
  return Number(row?.total ?? 0);
}

export async function listAccountTransactions(accountId: string): Promise<LedgerTransaction[]> {
  return db
    .select()
    .from(ledgerTransactions)
    .where(eq(ledgerTransactions.accountId, accountId))
    .orderBy(ledgerTransactions.createdAt);
}
