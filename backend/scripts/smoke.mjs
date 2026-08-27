/* eslint-disable no-console */
// Live smoke test of the core loop against a running server.
// Usage: node scripts/smoke.mjs   (server must be running on :4000)
const BASE = process.env.API_BASE_URL ?? 'http://localhost:4000';

let pass = 0;
let fail = 0;
function check(name, cond, extra) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.error(`  ✗ ${name}`, extra ?? '');
  }
}

async function api(path, { method = 'GET', token, body, rawHeaders } = {}) {
  const headers = { 'content-type': 'application/json', ...(rawHeaders ?? {}) };
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

async function login(mobile, role, name) {
  const otpRes = await api('/api/auth/send-otp', { method: 'POST', body: { mobile, role } });
  const code = otpRes.json?.data?.devOtp;
  if (!code) throw new Error(`No dev OTP for ${mobile} (${role}) — ${JSON.stringify(otpRes.json)}`);
  const verify = await api('/api/auth/verify-otp', {
    method: 'POST',
    body: { mobile, role, code, name },
  });
  const token = verify.json?.data?.token;
  const user = verify.json?.data?.user;
  if (!token) throw new Error(`Login failed for ${mobile}: ${JSON.stringify(verify.json)}`);
  return { token, user };
}

async function main() {
  console.log(`\nDigital Udhar — live smoke test @ ${BASE}\n`);

  // Health
  const health = await api('/api/health');
  check('health endpoint ok', health.status === 200 && health.json?.ok === true);

  // Logins
  const customer = await login('8000000001', 'CUSTOMER', 'Rahul Kumar');
  const rajesh = await login('9000000001', 'MERCHANT', 'Rajesh Sharma');
  const suresh = await login('9000000002', 'MERCHANT', 'Suresh Gupta');
  check('customer logged in', Boolean(customer.token));
  check('merchant logged in', Boolean(rajesh.token));

  const sharmaId = rajesh.user?.merchant?.id;
  const guptaId = suresh.user?.merchant?.id;
  check('merchant /me exposes shop id', Boolean(sharmaId));

  // Merchant QR → customer scans/resolves it
  const qrs = await api('/api/qr', { token: rajesh.token });
  const sharmaToken = qrs.json?.data?.[0]?.token;
  check('merchant has a counter QR', Boolean(sharmaToken));

  const resolved = await api(`/api/qr/${sharmaToken}`, { token: customer.token });
  check('customer resolves QR to shop', resolved.json?.data?.merchant?.id === sharmaId);
  const balanceBefore = resolved.json?.data?.myAccount?.outstandingPaise ?? 0;

  // Take udhaar ₹500
  const req = await api('/api/udhaar/request', {
    method: 'POST',
    token: customer.token,
    body: { merchantId: sharmaId, principalPaise: 50000, note: 'Smoke test udhaar' },
  });
  const udhaarId = req.json?.data?.id;
  check('udhaar requested (REQUESTED)', req.status === 201 && req.json?.data?.status === 'REQUESTED', req.json);

  // Wrong merchant cannot accept
  const wrongAccept = await api(`/api/udhaar/${udhaarId}/accept`, { method: 'POST', token: suresh.token });
  check('other shop cannot accept (403/404)', [403, 404, 409].includes(wrongAccept.status), wrongAccept.status);

  // Merchant accepts → ACTIVE + ledger entry
  const accept = await api(`/api/udhaar/${udhaarId}/accept`, { method: 'POST', token: rajesh.token });
  check('merchant accepts (ACTIVE)', accept.json?.data?.udhaar?.status === 'ACTIVE', accept.json);
  check('account balance rises by ₹500 after accept', accept.json?.data?.balanceAfterPaise === balanceBefore + 50000, { before: balanceBefore, after: accept.json?.data?.balanceAfterPaise });
  check('this udhaar outstanding = ₹500', accept.json?.data?.udhaar?.outstandingPaise === 50000, accept.json?.data?.udhaar?.outstandingPaise);
  check('agreement receipt created', Boolean(accept.json?.data?.receipt?.receiptNo));

  // Partial digital payment ₹300 → webhook verify → outstanding ₹200
  const order1 = await api('/api/payments/create-order', {
    method: 'POST',
    token: customer.token,
    body: { udhaarId, amountPaise: 30000 },
  });
  const orderId1 = order1.json?.data?.order?.gatewayOrderId;
  check('payment order created', Boolean(orderId1), order1.json);

  const pay1 = await api('/api/payments/mock/pay', {
    method: 'POST',
    token: customer.token,
    body: { gatewayOrderId: orderId1, outcome: 'success' },
  });
  check('webhook PROCESSED (success)', pay1.json?.data?.result?.status === 'PROCESSED', pay1.json);
  check('not cleared after partial pay', pay1.json?.data?.result?.cleared === false);

  const afterPartial = await api(`/api/udhaar/${udhaarId}`, { token: customer.token });
  check('outstanding = ₹200 after ₹300 paid', afterPartial.json?.data?.udhaar?.outstandingPaise === 20000, afterPartial.json?.data?.udhaar?.outstandingPaise);

  // Replaying the same order is rejected (already final)
  const replay = await api('/api/payments/mock/pay', {
    method: 'POST',
    token: customer.token,
    body: { gatewayOrderId: orderId1, outcome: 'success' },
  });
  check('replay of finalized order rejected (409)', replay.status === 409, replay.status);

  // Invalid webhook signature is rejected (401) and applies nothing
  const badHook = await api('/api/payments/webhook', {
    method: 'POST',
    rawHeaders: { 'x-webhook-signature': 'deadbeef' },
    body: { eventId: 'evt_fake', event: 'payment.captured', payload: { order: { id: orderId1 } } },
  });
  check('invalid webhook signature rejected (401)', badHook.status === 401, badHook.status);

  // Overpay guard
  const overOrder = await api('/api/payments/create-order', {
    method: 'POST',
    token: customer.token,
    body: { udhaarId, amountPaise: 999999 },
  });
  check('overpayment order rejected (400)', overOrder.status === 400, overOrder.status);

  // Final payment ₹200 → cleared, ₹0
  const order2 = await api('/api/payments/create-order', {
    method: 'POST',
    token: customer.token,
    body: { udhaarId, amountPaise: 20000 },
  });
  const orderId2 = order2.json?.data?.order?.gatewayOrderId;
  const pay2 = await api('/api/payments/mock/pay', {
    method: 'POST',
    token: customer.token,
    body: { gatewayOrderId: orderId2, outcome: 'success' },
  });
  check('final payment clears udhaar', pay2.json?.data?.result?.cleared === true, pay2.json);

  const cleared = await api(`/api/udhaar/${udhaarId}`, { token: customer.token });
  check('status CLEARED at ₹0', cleared.json?.data?.udhaar?.status === 'CLEARED' && cleared.json?.data?.udhaar?.outstandingPaise === 0, cleared.json?.data?.udhaar);

  // Immutable timeline recorded the whole journey
  const events = cleared.json?.data?.events ?? [];
  const types = events.map((e) => e.type);
  check('timeline has REQUESTED→ACCEPTED→REPAYMENT→CLEARED', ['REQUESTED', 'ACCEPTED', 'REPAYMENT', 'CLEARED'].every((t) => types.includes(t)), types);

  // Privacy: Sharma must not see the customer's Gupta udhaar
  const sharmaList = await api('/api/udhaar', { token: rajesh.token });
  const sharmaSeesGupta = (sharmaList.json?.data ?? []).some((u) => u.merchantId === guptaId);
  check('merchant privacy: Sharma cannot see Gupta khatas', sharmaSeesGupta === false);

  // Role escalation: customer cannot hit admin
  const adminPeek = await api('/api/admin/overview', { token: customer.token });
  check('customer blocked from admin (403)', adminPeek.status === 403, adminPeek.status);

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('Smoke test crashed:', err);
  process.exit(1);
});
