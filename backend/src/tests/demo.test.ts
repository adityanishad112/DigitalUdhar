import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { ensureSchema } from './helpers';
import { seed } from '../db/seed';

describe('Demo Module API', () => {
  const app = createApp();

  beforeAll(async () => {
    await ensureSchema();
    await seed();
  });

  it('retrieves demo accounts metadata', async () => {
    const res = await request(app).get('/api/demo/accounts');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.accounts).toBeInstanceOf(Array);
    expect(res.body.data.accounts.length).toBeGreaterThanOrEqual(4);

    const customer = res.body.data.accounts.find((a: { role: string }) => a.role === 'CUSTOMER');
    expect(customer).toBeDefined();
    expect(customer.mobile).toBe('8000000001');
  });

  it('performs 1-click quick-login for demo customer without OTP', async () => {
    const res = await request(app)
      .post('/api/demo/quick-login')
      .send({ mobile: '8000000001', role: 'CUSTOMER' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.role).toBe('CUSTOMER');
    expect(res.body.data.user.mobile).toBe('8000000001');
  });

  it('performs 1-click quick-login for merchant and admin', async () => {
    const resMerchant = await request(app)
      .post('/api/demo/quick-login')
      .send({ mobile: '9000000001', role: 'MERCHANT' });
    expect(resMerchant.status).toBe(200);
    expect(resMerchant.body.data.user.role).toBe('MERCHANT');

    const resAdmin = await request(app)
      .post('/api/demo/quick-login')
      .send({ mobile: '9999900000', role: 'ADMIN' });
    expect(resAdmin.status).toBe(200);
    expect(resAdmin.body.data.user.role).toBe('ADMIN');
  });

  it('can reset demo data and reseed', async () => {
    const res = await request(app).post('/api/demo/reset');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.success).toBe(true);
  });
});
