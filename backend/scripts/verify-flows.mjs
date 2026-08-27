// Broader flow smoke test against a RUNNING dev server.
//   node backend/scripts/verify-flows.mjs
// Covers the remaining verification-plan paths: invalid-QR, payment-failure,
// promise-to-pay, overdue bucket, dispute freeze, adjustment (append-only
// correction), and cash repayment. Each uses a fresh udhaar so they're isolated.
const BASE = process.env.API_BASE ?? 'http://localhost:4000/api';
// The seed assigns the Sharma merchant a fresh random UUID on every re-seed
// (registerMerchant → schema default), so resolve it at runtime from the
// merchant's own login response instead of hard-coding a stale id (see main()).
let SHARMA_MERCHANT_ID;

let pass = 0;
let fail = 0;
function check(label, cond, extra) {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}${extra !== undefined ? ` — ${JSON.stringify(extra)}` : ''}`); }
}

async function req(method, path, { token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json, data: json?.data };
}
async function login(mobile, role) {
  const otp = await req('POST', '/auth/send-otp', { body: { mobile, role } });
  const devOtp = otp.data?.devOtp;
  if (!devOtp) throw new Error(`send-otp failed: ${JSON.stringify(otp.json)}`);
  const v = await req('POST', '/auth/verify-otp', { body: { mobile, role, code: devOtp } });
  if (!v.data?.token) throw new Error(`verify-otp failed: ${JSON.stringify(v.json)}`);
  return { token: v.data.token, user: v.data.user };
}

let C, M;
async function freshUdhaar(principalPaise, dueDate) {
  const r = await req('POST', '/udhaar/request', {
    token: C,
    body: { merchantId: SHARMA_MERCHANT_ID, principalPaise, note: 'flow test', ...(dueDate ? { dueDate } : {}) },
  });
  const id = r.data?.id;
  await req('POST', `/udhaar/${id}/accept`, { token: M });
  return id;
}
const detail = (id, token = C) => req('GET', `/udhaar/${id}`, { token });

async function main() {
  console.log('— Broader flow smoke test —\n');
  const cust = await login('8000000001', 'CUSTOMER');
  const merch = await login('9000000001', 'MERCHANT');
  C = cust.token;
  M = merch.token;
  SHARMA_MERCHANT_ID = merch.user?.merchant?.id;
  check('resolved Sharma merchant id from login', Boolean(SHARMA_MERCHANT_ID), merch.user);

  // 1. Invalid QR token is rejected (never resolves to a shop).
  console.log('· Invalid QR');
  const badQr = await req('GET', '/qr/not-a-real-token-1234567890', { token: C });
  check('invalid QR token rejected (4xx)', badQr.status >= 400 && badQr.status < 500, badQr.status);

  // 2. Payment failure leaves the ledger untouched.
  console.log('· Payment failure');
  const pfId = await freshUdhaar(10000);
  const order = await req('POST', '/payments/create-order', { token: C, body: { udhaarId: pfId, amountPaise: 10000, method: 'UPI' } });
  const sim = await req('POST', '/payments/mock/pay', { token: C, body: { gatewayOrderId: order.data?.order?.gatewayOrderId, outcome: 'fail' } });
  check('webhook processed the failure', sim.data?.result?.status === 'PROCESSED', sim.data?.result);
  check('payment marked FAILED', sim.data?.result?.paymentStatus === 'FAILED', sim.data?.result?.paymentStatus);
  const pfDetail = await detail(pfId);
  check('udhaar stays ACTIVE after failed pay', pfDetail.data?.udhaar?.status === 'ACTIVE', pfDetail.data?.udhaar?.status);
  check('outstanding unchanged (₹100) after failed pay', pfDetail.data?.udhaar?.outstandingPaise === 10000, pfDetail.data?.udhaar?.outstandingPaise);
  check('no repayment event from a failed pay', !(pfDetail.data?.events ?? []).some((e) => e.type === 'REPAYMENT'), (pfDetail.data?.events ?? []).map((e) => e.type));

  // 3. Promise-to-pay moves the schedule bucket.
  console.log('· Promise to pay');
  const ptpId = await freshUdhaar(10000);
  const promisedDate = new Date(Date.now() + 3 * 864e5).toISOString();
  const ptp = await req('POST', `/udhaar/${ptpId}/promise-to-pay`, { token: C, body: { promisedDate, note: 'next week' } });
  check('promise recorded (201)', ptp.status === 201, ptp.json);
  const ptpDetail = await detail(ptpId);
  check('bucket = PROMISE_TO_PAY', ptpDetail.data?.udhaar?.bucket === 'PROMISE_TO_PAY', ptpDetail.data?.udhaar?.bucket);
  check('a PENDING promise is listed', (ptpDetail.data?.promises ?? []).some((p) => p.status === 'PENDING'), ptpDetail.data?.promises);

  // 4. A past due date computes to the OVERDUE bucket (server-derived).
  console.log('· Overdue');
  const odId = await freshUdhaar(10000, new Date(Date.now() - 2 * 864e5).toISOString());
  const odDetail = await detail(odId);
  check('bucket = OVERDUE for a past due date', odDetail.data?.udhaar?.bucket === 'OVERDUE', odDetail.data?.udhaar?.bucket);

  // 5. Dispute freezes the udhaar.
  console.log('· Dispute');
  const dpId = await freshUdhaar(10000);
  const dp = await req('POST', '/disputes', { token: C, body: { udhaarId: dpId, category: 'WRONG_AMOUNT', description: 'charged too much' } });
  check('dispute raised (201)', dp.status === 201, dp.json);
  const dpDetail = await detail(dpId);
  check('udhaar frozen to DISPUTED', dpDetail.data?.udhaar?.status === 'DISPUTED', dpDetail.data?.udhaar?.status);

  // 6. Adjustment posts an append-only correction (never edits the original).
  console.log('· Adjustment');
  const adjId = await freshUdhaar(10000);
  const adj = await req('POST', '/adjustments', { token: M, body: { udhaarId: adjId, amountPaise: -3000, reason: 'goodwill discount' } });
  check('adjustment posted (201)', adj.status === 201, adj.json);
  const adjDetail = await detail(adjId);
  check('outstanding reduced by ₹30 (backend math)', adjDetail.data?.udhaar?.outstandingPaise === 7000, adjDetail.data?.udhaar?.outstandingPaise);
  check('ADJUSTMENT event appended to timeline', (adjDetail.data?.events ?? []).some((e) => e.type === 'ADJUSTMENT'), (adjDetail.data?.events ?? []).map((e) => e.type));

  // 7. Cash repayment clears via the merchant, no gateway.
  console.log('· Cash repayment');
  const cashId = await freshUdhaar(10000);
  const cash = await req('POST', `/udhaar/${cashId}/cash-repayment`, { token: M, body: { amountPaise: 10000 } });
  check('cash repayment accepted (200)', cash.status === 200, cash.json);
  const cashDetail = await detail(cashId);
  check('udhaar CLEARED by full cash', cashDetail.data?.udhaar?.status === 'CLEARED', cashDetail.data?.udhaar?.status);
  check('outstanding ₹0 after cash', cashDetail.data?.udhaar?.outstandingPaise === 0, cashDetail.data?.udhaar?.outstandingPaise);
  check('CASH_REPAYMENT event on timeline', (cashDetail.data?.events ?? []).some((e) => e.type === 'CASH_REPAYMENT'), (cashDetail.data?.events ?? []).map((e) => e.type));
  const cashRepay = (cashDetail.data?.events ?? []).find((e) => e.type === 'CASH_REPAYMENT');
  check('cash repayment offers NO refund affordance (no paymentId)', !cashRepay?.metadata?.paymentId, cashRepay?.metadata);

  console.log(`\n— ${pass} passed, ${fail} failed —`);
  process.exit(fail === 0 ? 0 : 1);
}
main().catch((e) => { console.error('FATAL', e); process.exit(2); });
