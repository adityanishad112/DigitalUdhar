import { beforeAll, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { ledgerAccounts, ledgerTransactions, payments, udhaar } from '../db/schema';
import { ensureSchema, makeShop, makeUser } from './helpers';
import { acceptUdhaar, rejectUdhaar, requestUdhaar } from '../modules/udhaar/service';
import { createOrder, refundPayment, simulatePayment } from '../modules/payments/service';

beforeAll(async () => {
  await ensureSchema();
});

async function payDigitally(customerId: string, udhaarId: string, amountPaise: number) {
  const order = await createOrder(customerId, { udhaarId, amountPaise });
  return simulatePayment(customerId, order.order.gatewayOrderId, 'success');
}

describe('core udhaar + ledger loop', () => {
  it('accept posts one immutable ledger entry and sets the running balance', async () => {
    const { owner, merchant } = await makeShop('Ledger Store');
    const customer = await makeUser('CUSTOMER', 'Ledger Cust');

    const u = await requestUdhaar(customer.id, { merchantId: merchant.id, principalPaise: 50000 });
    expect(u.status).toBe('REQUESTED');

    const res = await acceptUdhaar(merchant.id, u.id, owner.id, 'MERCHANT');
    expect(res.udhaar.status).toBe('ACTIVE');
    expect(res.balanceAfterPaise).toBe(50000);

    const [account] = await db
      .select()
      .from(ledgerAccounts)
      .where(and(eq(ledgerAccounts.merchantId, merchant.id), eq(ledgerAccounts.customerUserId, customer.id)))
      .limit(1);
    expect(account.balancePaise).toBe(50000);
    expect(account.totalUdhaarPaise).toBe(50000);

    const txns = await db.select().from(ledgerTransactions).where(eq(ledgerTransactions.accountId, account.id));
    expect(txns).toHaveLength(1);
    expect(txns[0].amountPaise).toBe(50000);
    expect(txns[0].balanceAfterPaise).toBe(50000);
  });

  it('partial then full digital repayment clears the udhaar at ₹0', async () => {
    const { owner, merchant } = await makeShop('Repay Store');
    const customer = await makeUser('CUSTOMER', 'Repay Cust');

    const u = await requestUdhaar(customer.id, { merchantId: merchant.id, principalPaise: 50000 });
    await acceptUdhaar(merchant.id, u.id, owner.id, 'MERCHANT');

    const first = await payDigitally(customer.id, u.id, 30000);
    expect(first.result.status).toBe('PROCESSED');
    expect(first.result.cleared).toBe(false);

    let [row] = await db.select().from(udhaar).where(eq(udhaar.id, u.id)).limit(1);
    expect(row.outstandingPaise).toBe(20000);
    expect(row.status).toBe('ACTIVE');

    const second = await payDigitally(customer.id, u.id, 20000);
    expect(second.result.cleared).toBe(true);

    [row] = await db.select().from(udhaar).where(eq(udhaar.id, u.id)).limit(1);
    expect(row.outstandingPaise).toBe(0);
    expect(row.status).toBe('CLEARED');
    expect(row.clearedAt).not.toBeNull();

    // Balance recomputes to zero from the append-only ledger.
    const [account] = await db.select().from(ledgerAccounts).where(eq(ledgerAccounts.id, row.accountId)).limit(1);
    expect(account.balancePaise).toBe(0);
    const txns = await db.select().from(ledgerTransactions).where(eq(ledgerTransactions.accountId, row.accountId));
    expect(txns).toHaveLength(3); // 1 udhaar + 2 repayments
    expect(txns.reduce((s, t) => s + t.amountPaise, 0)).toBe(0);
  });

  it('rejects a repayment larger than the outstanding balance', async () => {
    const { owner, merchant } = await makeShop('Guard Store');
    const customer = await makeUser('CUSTOMER', 'Guard Cust');
    const u = await requestUdhaar(customer.id, { merchantId: merchant.id, principalPaise: 10000 });
    await acceptUdhaar(merchant.id, u.id, owner.id, 'MERCHANT');

    await expect(createOrder(customer.id, { udhaarId: u.id, amountPaise: 20000 })).rejects.toThrow();
  });

  it('enforces the per-transaction maximum', async () => {
    const { merchant } = await makeShop('Cap Store', { defaultMaxTxnPaise: 10000 });
    const customer = await makeUser('CUSTOMER', 'Cap Cust');
    await expect(
      requestUdhaar(customer.id, { merchantId: merchant.id, principalPaise: 20000 }),
    ).rejects.toThrow();
  });

  it('reject never creates a ledger entry', async () => {
    const { owner, merchant } = await makeShop('Reject Store');
    const customer = await makeUser('CUSTOMER', 'Reject Cust');
    const u = await requestUdhaar(customer.id, { merchantId: merchant.id, principalPaise: 15000 });
    const rejected = await rejectUdhaar(merchant.id, u.id, 'No thanks', owner.id, 'MERCHANT');
    expect(rejected.status).toBe('REJECTED');

    const [account] = await db
      .select()
      .from(ledgerAccounts)
      .where(and(eq(ledgerAccounts.merchantId, merchant.id), eq(ledgerAccounts.customerUserId, customer.id)))
      .limit(1);
    // No account/txn ever created for a rejected request.
    const txns = account
      ? await db.select().from(ledgerTransactions).where(eq(ledgerTransactions.accountId, account.id))
      : [];
    expect(txns).toHaveLength(0);
  });

  it('refund reverses a cleared udhaar back to ACTIVE via a new ledger row', async () => {
    const { owner, merchant } = await makeShop('Refund Store');
    const customer = await makeUser('CUSTOMER', 'Refund Cust');
    const u = await requestUdhaar(customer.id, { merchantId: merchant.id, principalPaise: 40000 });
    await acceptUdhaar(merchant.id, u.id, owner.id, 'MERCHANT');

    const paid = await payDigitally(customer.id, u.id, 40000);
    expect(paid.result.cleared).toBe(true);
    const paymentId = paid.result.paymentId!;

    const refund = await refundPayment({ id: owner.id, role: 'MERCHANT' }, paymentId, 15000, 'Overcharge');
    expect(refund.balanceAfterPaise).toBe(15000);

    const [row] = await db.select().from(udhaar).where(eq(udhaar.id, u.id)).limit(1);
    expect(row.status).toBe('ACTIVE');
    expect(row.outstandingPaise).toBe(15000);

    const [pay] = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
    expect(pay.refundedPaise).toBe(15000);
    expect(pay.status).toBe('PARTIALLY_REFUNDED');
  });
});
