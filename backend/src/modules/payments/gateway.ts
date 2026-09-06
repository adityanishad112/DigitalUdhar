import { CONFIG } from '../../core/config';
import { hmacSha256, safeEqualHex } from '../../core/crypto';
import {
  mockGatewayOrderId,
  mockGatewayPaymentId,
  mockGatewayRefundId,
  webhookEventId,
} from '../../core/ids';

export interface CreateOrderParams {
  amountPaise: number;
  currency?: string;
  receipt: string;
  notes?: Record<string, unknown>;
}

export interface CreatedOrder {
  gatewayOrderId: string;
  provider: string;
  amountPaise: number;
  currency: string;
}

export interface WebhookEnvelope {
  /** The exact raw JSON string that was signed. */
  body: string;
  signature: string;
}

/**
 * Abstraction over a payment provider. The MockGateway below faithfully mimics a
 * Razorpay-style flow (order → checkout → signed server-to-server webhook). A real
 * RazorpayGateway can be dropped in behind this interface using the same env keys
 * (PAYMENT_GATEWAY_KEY_ID / _SECRET / _WEBHOOK_SECRET) — no call-site changes.
 */
export interface PaymentGateway {
  readonly provider: string;
  /** Public key id — safe to expose to the browser checkout (never the secret). */
  readonly publicKeyId: string;
  createOrder(params: CreateOrderParams): Promise<CreatedOrder>;
  createRefund(params: { gatewayPaymentId: string; amountPaise: number }): Promise<{ gatewayRefundId: string }>;
  /** Verify an inbound webhook's HMAC signature over the raw body. */
  verifyWebhookSignature(envelope: WebhookEnvelope): boolean;
  /** Verify checkout client response signature: HMAC-SHA256 of orderId|paymentId using keySecret. */
  verifyPaymentSignature(params: { orderId: string; paymentId: string; signature: string }): boolean;
  /** Build a signed webhook envelope — used by the mock checkout or tests to call us back. */
  buildWebhook(event: {
    eventType: 'payment.captured' | 'payment.failed';
    gatewayOrderId: string;
    gatewayPaymentId: string;
    amountPaise: number;
    failureReason?: string;
  }): WebhookEnvelope & { eventId: string };
}

class MockGateway implements PaymentGateway {
  readonly provider = 'mock';
  get publicKeyId() {
    return CONFIG.gateway.keyId;
  }

  async createOrder(params: CreateOrderParams): Promise<CreatedOrder> {
    return {
      gatewayOrderId: mockGatewayOrderId(),
      provider: this.provider,
      amountPaise: params.amountPaise,
      currency: params.currency ?? 'INR',
    };
  }

  async createRefund(): Promise<{ gatewayRefundId: string }> {
    return { gatewayRefundId: mockGatewayRefundId() };
  }

  verifyWebhookSignature({ body, signature }: WebhookEnvelope): boolean {
    const expected = hmacSha256(CONFIG.gateway.webhookSecret, body);
    return safeEqualHex(expected, signature);
  }

  verifyPaymentSignature(params: { orderId: string; paymentId: string; signature: string }): boolean {
    const expected = hmacSha256(CONFIG.gateway.keySecret, `${params.orderId}|${params.paymentId}`);
    return safeEqualHex(expected, params.signature);
  }

  buildWebhook(event: {
    eventType: 'payment.captured' | 'payment.failed';
    gatewayOrderId: string;
    gatewayPaymentId: string;
    amountPaise: number;
    failureReason?: string;
  }) {
    const eventId = webhookEventId();
    const payload = {
      eventId,
      event: event.eventType,
      createdAt: new Date().toISOString(),
      payload: {
        order: { id: event.gatewayOrderId },
        payment: {
          id: event.gatewayPaymentId,
          amountPaise: event.amountPaise,
          status: event.eventType === 'payment.captured' ? 'captured' : 'failed',
          failureReason: event.failureReason,
        },
      },
    };
    const body = JSON.stringify(payload);
    const signature = hmacSha256(CONFIG.gateway.webhookSecret, body);
    return { eventId, body, signature };
  }
}

export class RazorpayGateway implements PaymentGateway {
  readonly provider = 'razorpay';

  constructor(
    private readonly keyId = CONFIG.gateway.keyId,
    private readonly keySecret = CONFIG.gateway.keySecret,
    private readonly webhookSecret = CONFIG.gateway.webhookSecret,
    private readonly apiBase = 'https://api.razorpay.com/v1',
  ) {}

  get publicKeyId(): string {
    return this.keyId;
  }

  private get authHeader(): string {
    return 'Basic ' + Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
  }

  async createOrder(params: CreateOrderParams): Promise<CreatedOrder> {
    const res = await fetch(`${this.apiBase}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.authHeader,
      },
      body: JSON.stringify({
        amount: params.amountPaise,
        currency: params.currency ?? 'INR',
        receipt: params.receipt,
        notes: params.notes,
      }),
    });

    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: { description?: string } };
      throw new Error(err?.error?.description || `Razorpay order creation failed with status ${res.status}`);
    }

    const data = (await res.json()) as { id: string; amount: number; currency: string };
    return {
      gatewayOrderId: data.id,
      provider: this.provider,
      amountPaise: data.amount,
      currency: data.currency ?? 'INR',
    };
  }

  async createRefund(params: { gatewayPaymentId: string; amountPaise: number }): Promise<{ gatewayRefundId: string }> {
    const res = await fetch(`${this.apiBase}/payments/${params.gatewayPaymentId}/refund`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.authHeader,
      },
      body: JSON.stringify({
        amount: params.amountPaise,
      }),
    });

    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: { description?: string } };
      throw new Error(err?.error?.description || `Razorpay refund failed with status ${res.status}`);
    }

    const data = (await res.json()) as { id: string };
    return { gatewayRefundId: data.id };
  }

  verifyWebhookSignature({ body, signature }: WebhookEnvelope): boolean {
    const expected = hmacSha256(this.webhookSecret, body);
    return safeEqualHex(expected, signature);
  }

  verifyPaymentSignature(params: { orderId: string; paymentId: string; signature: string }): boolean {
    const expected = hmacSha256(this.keySecret, `${params.orderId}|${params.paymentId}`);
    return safeEqualHex(expected, params.signature);
  }

  buildWebhook(event: {
    eventType: 'payment.captured' | 'payment.failed';
    gatewayOrderId: string;
    gatewayPaymentId: string;
    amountPaise: number;
    failureReason?: string;
  }) {
    const eventId = webhookEventId();
    const payload = {
      entity: 'event',
      account_id: 'acc_live',
      event: event.eventType,
      contains: ['payment'],
      payload: {
        payment: {
          entity: {
            id: event.gatewayPaymentId,
            entity: 'payment',
            amount: event.amountPaise,
            currency: 'INR',
            status: event.eventType === 'payment.captured' ? 'captured' : 'failed',
            order_id: event.gatewayOrderId,
            error_description: event.failureReason,
          },
        },
        order: {
          entity: {
            id: event.gatewayOrderId,
            entity: 'order',
            amount: event.amountPaise,
            currency: 'INR',
          },
        },
      },
      created_at: Math.floor(Date.now() / 1000),
    };
    const body = JSON.stringify(payload);
    const signature = hmacSha256(this.webhookSecret, body);
    return { eventId, body, signature };
  }
}

export function getGateway(): PaymentGateway {
  switch (CONFIG.gateway.provider.toLowerCase()) {
    case 'razorpay':
      return new RazorpayGateway();
    case 'mock':
    default:
      return new MockGateway();
  }
}

export const mockPaymentId = mockGatewayPaymentId;
