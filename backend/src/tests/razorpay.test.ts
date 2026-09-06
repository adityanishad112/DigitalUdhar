import { beforeAll, describe, expect, it, vi } from 'vitest';
import { RazorpayGateway } from '../modules/payments/gateway';
import { parseWebhook, verifyPayment, createOrder } from '../modules/payments/service';
import { hmacSha256 } from '../core/crypto';
import { db } from '../db/client';
import { payments, udhaar } from '../db/schema';
import { eq } from 'drizzle-orm';
import { ensureSchema, makeShop, makeUser } from './helpers';
import { acceptUdhaar, requestUdhaar } from '../modules/udhaar/service';

beforeAll(async () => {
  await ensureSchema();
});

describe('RazorpayGateway unit tests', () => {
  const keyId = 'rzp_test_samplekey123';
  const keySecret = 'samplesecret456';
  const webhookSecret = 'samplewebhooksecret789';
  const gateway = new RazorpayGateway(keyId, keySecret, webhookSecret);

  it('verifies checkout payment response signature correctly', () => {
    const orderId = 'order_DA12345678';
    const paymentId = 'pay_DA87654321';
    const validSignature = hmacSha256(keySecret, `${orderId}|${paymentId}`);

    expect(gateway.verifyPaymentSignature({ orderId, paymentId, signature: validSignature })).toBe(true);

    // Tampered signature
    expect(gateway.verifyPaymentSignature({ orderId, paymentId, signature: 'invalid_sig' })).toBe(false);

    // Wrong order ID
    expect(gateway.verifyPaymentSignature({ orderId: 'order_wrong', paymentId, signature: validSignature })).toBe(false);
  });

  it('verifies webhook signature correctly', () => {
    const rawBody = JSON.stringify({ event: 'payment.captured', payload: {} });
    const validSignature = hmacSha256(webhookSecret, rawBody);

    expect(gateway.verifyWebhookSignature({ body: rawBody, signature: validSignature })).toBe(true);
    expect(gateway.verifyWebhookSignature({ body: rawBody, signature: 'bad_sig' })).toBe(false);
  });

  it('creates an order via Razorpay API with correct payload and headers', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'order_rzp_abc123',
        amount: 25000,
        currency: 'INR',
        status: 'created',
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await gateway.createOrder({
      amountPaise: 25000,
      currency: 'INR',
      receipt: 'PAY-12345',
      notes: { udhaarId: 'u_1' },
    });

    expect(result).toEqual({
      gatewayOrderId: 'order_rzp_abc123',
      provider: 'razorpay',
      amountPaise: 25000,
      currency: 'INR',
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.razorpay.com/v1/orders',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: expect.stringMatching(/^Basic /),
        }),
      }),
    );

    vi.unstubAllGlobals();
  });

  it('handles Razorpay API errors when creating orders', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          error: { description: 'Order amount exceeds limit' },
        }),
      }),
    );

    await expect(
      gateway.createOrder({
        amountPaise: 999999999,
        receipt: 'PAY-12345',
      }),
    ).rejects.toThrow('Order amount exceeds limit');

    vi.unstubAllGlobals();
  });

  it('creates refunds via Razorpay API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'rfnd_rzp_xyz789',
          amount: 5000,
        }),
      }),
    );

    const result = await gateway.createRefund({
      gatewayPaymentId: 'pay_123',
      amountPaise: 5000,
    });

    expect(result).toEqual({ gatewayRefundId: 'rfnd_rzp_xyz789' });

    vi.unstubAllGlobals();
  });
});

describe('Webhook payload parsing', () => {
  it('parses real Razorpay native webhook payload format', () => {
    const razorpayPayload = {
      entity: 'event',
      account_id: 'acc_test123',
      event: 'payment.captured',
      contains: ['payment'],
      payload: {
        payment: {
          entity: {
            id: 'pay_real123',
            entity: 'payment',
            amount: 50000,
            currency: 'INR',
            status: 'captured',
            order_id: 'order_real123',
            error_description: null,
          },
        },
        order: {
          entity: {
            id: 'order_real123',
            entity: 'order',
            amount: 50000,
          },
        },
      },
      created_at: 1725000000,
    };

    const parsed = parseWebhook(JSON.stringify(razorpayPayload), 'evt_custom_header_id');
    expect(parsed.event).toBe('payment.captured');
    expect(parsed.gatewayOrderId).toBe('order_real123');
    expect(parsed.gatewayPaymentId).toBe('pay_real123');
    expect(parsed.amountPaise).toBe(50000);
    expect(parsed.eventId).toBe('evt_custom_header_id');
  });

  it('parses mock webhook payload format for backward compatibility', () => {
    const mockPayload = {
      eventId: 'evt_mock123',
      event: 'payment.captured',
      payload: {
        order: { id: 'order_mock123' },
        payment: {
          id: 'pay_mock123',
          amountPaise: 2000,
          status: 'captured',
        },
      },
    };

    const parsed = parseWebhook(JSON.stringify(mockPayload));
    expect(parsed.event).toBe('payment.captured');
    expect(parsed.gatewayOrderId).toBe('order_mock123');
    expect(parsed.gatewayPaymentId).toBe('pay_mock123');
    expect(parsed.amountPaise).toBe(2000);
    expect(parsed.eventId).toBe('evt_mock123');
  });
});

describe('verifyPayment service integration', () => {
  it('verifies client checkout signature and completes payment idempotently', async () => {
    // 1. Create a customer, merchant, and accepted udhaar
    const { owner, merchant } = await makeShop('Razorpay Kirana');
    const customer = await makeUser('CUSTOMER', 'Rzp Customer');
    const u = await requestUdhaar(customer.id, { merchantId: merchant.id, principalPaise: 50000 });
    await acceptUdhaar(merchant.id, u.id, owner.id, 'MERCHANT');

    // 2. Customer creates an order
    const orderRes = await createOrder(customer.id, {
      udhaarId: u.id,
      amountPaise: 20000,
      method: 'UPI',
    });

    const gatewayOrderId = orderRes.order.gatewayOrderId;
    const gatewayPaymentId = 'pay_client_completed_123';
    const { CONFIG } = await import('../core/config');
    const validSignature = hmacSha256(CONFIG.gateway.keySecret, `${gatewayOrderId}|${gatewayPaymentId}`);

    // 3. Call verifyPayment with valid signature
    const verifyRes = await verifyPayment(customer.id, {
      gatewayOrderId,
      gatewayPaymentId,
      signature: validSignature,
    });

    expect(verifyRes.result.status).toBe('PROCESSED');
    expect(verifyRes.result.paymentStatus).toBe('SUCCESS');

    // 4. Verify udhaar balance decreased
    const [updatedU] = await db.select().from(udhaar).where(eq(udhaar.id, u.id)).limit(1);
    expect(updatedU.outstandingPaise).toBe(30000);

    // 5. Verify payment row updated to SUCCESS
    const [payRow] = await db.select().from(payments).where(eq(payments.gatewayOrderId, gatewayOrderId)).limit(1);
    expect(payRow.status).toBe('SUCCESS');
    expect(payRow.gatewayPaymentId).toBe(gatewayPaymentId);

    // 6. Calling verifyPayment again is idempotent
    const duplicateRes = await verifyPayment(customer.id, {
      gatewayOrderId,
      gatewayPaymentId,
      signature: validSignature,
    });
    expect(duplicateRes.result.status).toBe('ALREADY_FINAL');
    expect(duplicateRes.result.paymentStatus).toBe('SUCCESS');
  });
});
