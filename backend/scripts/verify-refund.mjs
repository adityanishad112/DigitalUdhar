// End-to-end smoke test for the refund path against a RUNNING dev server.
//   node backend/scripts/verify-refund.mjs
// Drives: request → accept → digital pay (mock success) → assert the REPAYMENT
// event now carries metadata.paymentId (the bug that made refunds unreachable)
// → merchant refund → assert append-only REFUND row, un-clear, refund receipt,
// and a PAYMENT_REFUNDED audit row. Read-only against real financial invariants.
const BASE = process.env.API_BASE ?? 'http://localhost:4000/api';

let pass = 0;
let fail = 0;
function check(label, cond, extra) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}`);
  } else {
    fail++;
    console.log(`  ✗ ${label}${extra ? ` — ${JSON.stringify(extra)}` : ''}`);
  }
}

async function req(method, path, { token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json, data: json?.data };
}

async function login(mobile, role) {
  const otp = await req('POST', '/auth/send-otp', { body: { mobile, role } });
  const devOtp = otp.data?.devOtp;
  if (!devOtp) throw new Error(`send-otp failed for ${mobile}/${role}: ${JSON.stringify(otp.json)}`);
  const v = await req('POST', '/auth/verify-otp', { body: { mobile, role, code: devOtp } });
  const token = v.data?.token;
  if (!token) throw new Error(`verify-otp failed for ${mobile}/${role}: ${JSON.stringify(v.json)}`);
  return { token, user: v.data.user };
}

const INR = (p) => `₹${(p / 100).toLocaleString('en-IN')}`;

async function main() {
  console.log('— Refund path smoke test —\n');

  const health = await req('GET', '/health');
  check('server health ok', health.status === 200, health.json);

  const customer = await login('8000000001', 'CUSTOMER');
  const merchant = await login('9000000001', 'MERCHANT');
  const admin = await login('9999900000', 'ADMIN');
  console.log(`  logged in: customer=${customer.user.name}, merchant=${merchant.user.name}, admin=${admin.user.name}\n`);

  // The seed assigns Sharma a random merchant UUID on each re-seed, so read the
  // real id from the merchant's own login response rather than hard-coding it.
  const sharmaId = merchant.user?.merchant?.id;
  check('resolved Sharma merchant id from login', Boolean(sharmaId), merchant.user);

  // 1. Customer takes a fresh ₹250 udhaar at Sharma.
  const AMOUNT = 25000;
  const reqRes = await req('POST', '/udhaar/request', {
    token: customer.token,
    body: { merchantId: sharmaId, principalPaise: AMOUNT, note: 'refund smoke test' },
  });
  check('udhaar requested (201)', reqRes.status === 201, reqRes.json);
  const udhaarId = reqRes.data?.id;
  check('udhaar starts REQUESTED', reqRes.data?.status === 'REQUESTED', reqRes.data?.status);

  // 2. Merchant accepts → ACTIVE.
  const accept = await req('POST', `/udhaar/${udhaarId}/accept`, { token: merchant.token });
  check('merchant accepted (200)', accept.status === 200, accept.json);

  let detail = await req('GET', `/udhaar/${udhaarId}`, { token: customer.token });
  check('udhaar now ACTIVE', detail.data?.udhaar?.status === 'ACTIVE', detail.data?.udhaar?.status);
  check(`outstanding = ${INR(AMOUNT)}`, detail.data?.udhaar?.outstandingPaise === AMOUNT, detail.data?.udhaar?.outstandingPaise);

  // 3. Customer pays it in full digitally (mock gateway success).
  const order = await req('POST', '/payments/create-order', {
    token: customer.token,
    body: { udhaarId, amountPaise: AMOUNT, method: 'UPI' },
  });
  check('order created (201)', order.status === 201, order.json);
  const gatewayOrderId = order.data?.order?.gatewayOrderId;

  const sim = await req('POST', '/payments/mock/pay', {
    token: customer.token,
    body: { gatewayOrderId, outcome: 'success' },
  });
  const simResult = sim.data?.result;
  check('webhook PROCESSED', simResult?.status === 'PROCESSED', simResult?.status);
  check('payment SUCCESS', simResult?.paymentStatus === 'SUCCESS', simResult?.paymentStatus);
  check('udhaar cleared by full payment', simResult?.cleared === true, simResult?.cleared);
  const paymentId = simResult?.paymentId;

  // 4. THE FIX: the REPAYMENT event must now carry metadata.paymentId, which is
  //    what the merchant UI gates the "Refund this payment" button on.
  detail = await req('GET', `/udhaar/${udhaarId}`, { token: customer.token });
  const events = detail.data?.events ?? [];
  const repayEvent = events.find((e) => e.type === 'REPAYMENT');
  check('REPAYMENT event exists', Boolean(repayEvent), events.map((e) => e.type));
  check(
    'REPAYMENT event carries metadata.paymentId (refund now reachable from UI)',
    repayEvent?.metadata?.paymentId === paymentId,
    { got: repayEvent?.metadata, expected: paymentId },
  );
  check('udhaar CLEARED after full pay', detail.data?.udhaar?.status === 'CLEARED', detail.data?.udhaar?.status);
  check('outstanding ₹0 after full pay', detail.data?.udhaar?.outstandingPaise === 0, detail.data?.udhaar?.outstandingPaise);

  const eventsBeforeRefund = events.length;

  // 5. Merchant refunds the payment.
  const REFUND = 25000;
  // balanceAfterPaise is the SHOP-LEVEL account balance (sum across the customer's
  // udhaar at this shop), so capture it before to assert it rose by the refund.
  const acctBefore = detail.data?.account?.outstandingPaise ?? 0;
  const refund = await req('POST', `/payments/${paymentId}/refund`, {
    token: merchant.token,
    body: { amountPaise: REFUND, reason: 'smoke test refund' },
  });
  check('refund accepted (200)', refund.status === 200, refund.json);
  check('refund receipt created', Boolean(refund.data?.receipt), refund.data);
  check(
    `account balanceAfter rose by ${INR(REFUND)}`,
    refund.data?.balanceAfterPaise === acctBefore + REFUND,
    { before: acctBefore, after: refund.data?.balanceAfterPaise },
  );

  // 6. Post-refund invariants: append-only REFUND row, un-clear, outstanding up.
  detail = await req('GET', `/udhaar/${udhaarId}`, { token: customer.token });
  const eventsAfter = detail.data?.events ?? [];
  check('event timeline is append-only (grew, none removed)', eventsAfter.length > eventsBeforeRefund, {
    before: eventsBeforeRefund,
    after: eventsAfter.length,
  });
  check('a REFUND event was appended', eventsAfter.some((e) => e.type === 'REFUND'), eventsAfter.map((e) => e.type));
  check('udhaar un-cleared back to ACTIVE', detail.data?.udhaar?.status === 'ACTIVE', detail.data?.udhaar?.status);
  check(`outstanding rose back to ${INR(REFUND)}`, detail.data?.udhaar?.outstandingPaise === REFUND, detail.data?.udhaar?.outstandingPaise);

  // 7. The refund is audited.
  const audit = await req('GET', '/admin/audit-logs', { token: admin.token });
  const auditText = JSON.stringify(audit.data ?? {});
  check('PAYMENT_REFUNDED audit row present', auditText.includes('PAYMENT_REFUNDED') && auditText.includes(paymentId), {
    status: audit.status,
  });

  // 8. Refunding again must fail (nothing left to refund) — no double refund.
  const again = await req('POST', `/payments/${paymentId}/refund`, {
    token: merchant.token,
    body: { amountPaise: REFUND, reason: 'double refund attempt' },
  });
  check('second full refund rejected (idempotent guard)', again.status >= 400, again.status);

  console.log(`\n— ${pass} passed, ${fail} failed —`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(2);
});
