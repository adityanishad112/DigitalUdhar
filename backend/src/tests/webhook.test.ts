import { beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { payments, paymentWebhooks, udhaar } from '../db/schema';
import { ensureSchema, makeShop, makeUser } from './helpers';
import { acceptUdhaar, requestUdhaar } from '../modules/udhaar/service';
import { createOrder, processWebhook } from '../modules/payments/service';
import { getGateway, mockPaymentId } from '../modules/payments/gateway';

beforeAll(async () => {
  await ensureSchema();
});

async function activeUdhaarWithOrder(principal: number, amount: number) {
  const { owner, merchant } = await makeShop(`WH ${Math.floor(principal + amount)}`);
  const customer = await makeUser('CUSTOMER', 'WH Cust');
  const u = await requestUdhaar(customer.id, { merchantId: merchant.id, principalPaise: principal });
  await acceptUdhaar(merchant.id, u.id, owner.id, 'MERCHANT');
  const order = await createOrder(customer.id, { udhaarId: u.id, amountPaise: amount });
  return { u, order, customer, gatewayOrderId: order.order.gatewayOrderId };
}

describe('payment webhook — signature & idempotency', () => {
  it('applies a captured payment exactly once even if the webhook is delivered twice', async () => {
    const { u, gatewayOrderId } = await activeUdhaarWithOrder(50000, 30000);

    const envelope = getGateway().buildWebhook({
      eventType: 'payment.captured',
      gatewayOrderId,
      gatewayPaymentId: mockPaymentId(),
      amountPaise: 30000,
    });

    const first = await processWebhook(envelope.body, envelope.signature);
    expect(first.status).toBe('PROCESSED');

    // Exact same signed delivery again → recognised as a duplicate, not re-applied.
    const second = await processWebhook(envelope.body, envelope.signature);
    expect(second.status).toBe('DUPLICATE');

    const [row] = await db.select().from(udhaar).where(eq(udhaar.id, u.id)).limit(1);
    expect(row.outstandingPaise).toBe(20000); // reduced once, not twice

    // Only one webhook row and one repayment recorded for this event.
    const hooks = await db.select().from(paymentWebhooks).where(eq(paymentWebhooks.eventId, envelope.eventId));
    expect(hooks).toHaveLength(1);
  });

  it('rejects a webhook with an invalid signature and applies nothing', async () => {
    const { u, gatewayOrderId } = await activeUdhaarWithOrder(50000, 25000);

    const envelope = getGateway().buildWebhook({
      eventType: 'payment.captured',
      gatewayOrderId,
      gatewayPaymentId: mockPaymentId(),
      amountPaise: 25000,
    });

    await expect(processWebhook(envelope.body, 'not-a-valid-signature')).rejects.toThrow(/signature/i);

    const [row] = await db.select().from(udhaar).where(eq(udhaar.id, u.id)).limit(1);
    expect(row.outstandingPaise).toBe(50000); // untouched
    const [pay] = await db.select().from(payments).where(eq(payments.gatewayOrderId, gatewayOrderId)).limit(1);
    expect(pay.status).toBe('CREATED');
  });

  it('marks a failed payment FAILED without touching the ledger', async () => {
    const { u, gatewayOrderId } = await activeUdhaarWithOrder(50000, 20000);

    const envelope = getGateway().buildWebhook({
      eventType: 'payment.failed',
      gatewayOrderId,
      gatewayPaymentId: mockPaymentId(),
      amountPaise: 20000,
      failureReason: 'insufficient funds',
    });
    const res = await processWebhook(envelope.body, envelope.signature);
    expect(res.paymentStatus).toBe('FAILED');

    const [row] = await db.select().from(udhaar).where(eq(udhaar.id, u.id)).limit(1);
    expect(row.outstandingPaise).toBe(50000);
    const [pay] = await db.select().from(payments).where(eq(payments.gatewayOrderId, gatewayOrderId)).limit(1);
    expect(pay.status).toBe('FAILED');
  });
});
