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
  /** Build a signed webhook envelope — used by the mock checkout to call us back. */
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

export function getGateway(): PaymentGateway {
  // Only the mock provider is implemented; a real one plugs in here by provider name.
  switch (CONFIG.gateway.provider) {
    case 'mock':
    default:
      return new MockGateway();
  }
}

export const mockPaymentId = mockGatewayPaymentId;
