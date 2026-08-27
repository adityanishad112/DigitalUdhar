import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { ensureSchema, makeShop, uniqueMobile } from './helpers';

const app = createApp();

async function loginViaHttp(mobile: string, role: string, name?: string) {
  await request(app).post('/api/auth/send-otp').send({ mobile, role });
  const sent = await request(app).post('/api/auth/send-otp').send({ mobile, role });
  const code = sent.body?.data?.devOtp;
  const verify = await request(app).post('/api/auth/verify-otp').send({ mobile, role, code, name });
  return verify.body?.data?.token as string;
}

beforeAll(async () => {
  await ensureSchema();
});

describe('HTTP auth & RBAC', () => {
  it('rejects unauthenticated access to protected routes', async () => {
    const res = await request(app).get('/api/udhaar');
    expect(res.status).toBe(401);
  });

  it('logs in a customer and returns their profile', async () => {
    const token = await loginViaHttp(uniqueMobile('9'), 'CUSTOMER', 'Http Cust');
    expect(token).toBeTruthy();
    const me = await request(app).get('/api/auth/me').set('authorization', `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect(me.body.data.role).toBe('CUSTOMER');
  });

  it('forbids a customer from reaching admin endpoints', async () => {
    const token = await loginViaHttp(uniqueMobile('9'), 'CUSTOMER', 'Not Admin');
    const res = await request(app).get('/api/admin/overview').set('authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('forbids a customer from generating merchant QR codes', async () => {
    const token = await loginViaHttp(uniqueMobile('9'), 'CUSTOMER', 'Cust QR');
    const res = await request(app)
      .post('/api/qr/generate')
      .set('authorization', `Bearer ${token}`)
      .send({ label: 'hack' });
    expect(res.status).toBe(403);
  });

  it('rejects a malformed webhook body with a 4xx', async () => {
    const res = await request(app)
      .post('/api/payments/webhook')
      .set('x-webhook-signature', 'bad')
      .send({ nonsense: true });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('lets a merchant see an empty khata list initially', async () => {
    const { owner } = await makeShop('HTTP Shop');
    const token = await loginViaHttp(owner.mobile, 'MERCHANT');
    const res = await request(app).get('/api/udhaar').set('authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
