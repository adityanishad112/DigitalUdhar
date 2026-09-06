import { and, eq, sql } from 'drizzle-orm';
import { db } from '../../db/client';
import {
  accounts,
  auditLogs,
  disputes,
  identityVerifications,
  invoices,
  ledgerTxns,
  merchants,
  merchantStaff,
  notifications,
  otpCodes,
  paymentRefunds,
  payments,
  products,
  promiseToPay,
  qrCodes,
  reminders,
  udhaar,
  udhaarEvents,
  userProfiles,
  users,
  webhookEvents,
} from '../../db/schema';
import type { UserRole } from '../../db/schema/enums';
import { signToken } from '../../core/jwt';
import { getMe } from '../auth/service';
import { seed } from '../../db/seed';
import { BadRequestError } from '../../core/errors';
import { acceptUdhaar, requestUdhaar } from '../udhaar/service';

export interface DemoAccountMeta {
  role: UserRole;
  mobile: string;
  name: string;
  label: string;
  description: string;
  badge: string;
  shopName?: string;
  qrToken?: string;
  qrUrl?: string;
}

export const DEMO_PROFILES: DemoAccountMeta[] = [
  {
    role: 'CUSTOMER',
    mobile: '8000000001',
    name: 'Rahul Kumar',
    label: 'Rahul Kumar',
    description: 'Active customer with open credit across Sharma & Gupta stores.',
    badge: 'Customer',
  },
  {
    role: 'MERCHANT',
    mobile: '9000000001',
    name: 'Rajesh Sharma',
    label: 'Sharma General Store',
    description: 'Kirana & provisions store owner with counter QR and active khata ledger.',
    badge: 'Merchant 1',
    shopName: 'Sharma General Store',
  },
  {
    role: 'MERCHANT',
    mobile: '9000000002',
    name: 'Suresh Gupta',
    label: 'Gupta General Store',
    description: 'Independent merchant demonstrating strict customer privacy separation.',
    badge: 'Merchant 2',
    shopName: 'Gupta General Store',
  },
  {
    role: 'ADMIN',
    mobile: '9999900000',
    name: 'Platform Admin',
    label: 'Platform Admin',
    description: 'System administrator with audit log inspection, user governance, and metrics.',
    badge: 'Admin',
  },
];

export async function getDemoAccounts() {
  const merchantQrs = await db
    .select({
      merchantId: qrCodes.merchantId,
      token: qrCodes.token,
      shopName: merchants.shopName,
      city: merchants.city,
      category: merchants.category,
    })
    .from(qrCodes)
    .innerJoin(merchants, eq(qrCodes.merchantId, merchants.id));

  const accountsWithMeta = await Promise.all(
    DEMO_PROFILES.map(async (acc) => {
      const user = await db.query.users.findFirst({
        where: and(eq(users.mobile, acc.mobile), eq(users.role, acc.role)),
      });

      let merchantInfo: (typeof merchantQrs)[0] | undefined;
      if (acc.role === 'MERCHANT' && user) {
        const m = await db.query.merchants.findFirst({
          where: eq(merchants.ownerUserId, user.id),
        });
        if (m) {
          merchantInfo = merchantQrs.find((q) => q.merchantId === m.id);
        }
      }

      return {
        ...acc,
        userId: user?.id ?? null,
        qrToken: merchantInfo?.token ?? undefined,
        qrUrl: merchantInfo?.token ? `/s/${merchantInfo.token}` : undefined,
        city: merchantInfo?.city ?? undefined,
        category: merchantInfo?.category ?? undefined,
      };
    }),
  );

  const [{ totalUdhaars }] = await db
    .select({ totalUdhaars: sql<number>`count(*)` })
    .from(udhaar);

  return {
    accounts: accountsWithMeta,
    stats: {
      totalUdhaars: Number(totalUdhaars),
    },
    demoReady: true,
  };
}

export async function quickLogin(mobile: string, role: UserRole) {
  // Allow all registered demo profiles or any number in dev mode
  const validDemo = DEMO_PROFILES.find((p) => p.mobile === mobile && p.role === role);
  if (!validDemo && process.env.NODE_ENV === 'production') {
    throw new BadRequestError('Quick login is only available for demo accounts');
  }

  let user = await db.query.users.findFirst({
    where: and(eq(users.mobile, mobile), eq(users.role, role)),
  });

  if (!user) {
    // If user does not exist yet, create them on the fly
    user = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(users)
        .values({
          mobile,
          role,
          name: validDemo?.name ?? 'Demo User',
          mobileVerified: true,
        })
        .returning();
      await tx.insert(userProfiles).values({ userId: created.id, city: 'Kanpur', state: 'Uttar Pradesh' });
      await tx.insert(identityVerifications).values({ userId: created.id, status: 'UNVERIFIED' });
      return created;
    });
  } else {
    await db
      .update(users)
      .set({ mobileVerified: true, lastLoginAt: new Date() })
      .where(eq(users.id, user.id));
  }

  const token = signToken({ sub: user.id, role: user.role, mobile: user.mobile });
  const me = await getMe(user.id);
  return { token, user: me };
}

export async function resetDemoData() {
  const tableNames = [
    'audit_logs',
    'notifications',
    'reminders',
    'disputes',
    'payment_refunds',
    'webhook_events',
    'payments',
    'ledger_transactions',
    'promise_to_pay',
    'udhaar_events',
    'udhaar',
    'invoices',
    'products',
    'ledger_accounts',
    'merchant_customers',
    'qr_codes',
    'merchant_staff',
    'merchants',
    'identity_verifications',
    'user_profiles',
    'otp_codes',
    'users',
  ];

  try {
    // In PostgreSQL / PGlite, TRUNCATE with CASCADE clears everything cleanly
    await db.execute(sql.raw(`TRUNCATE TABLE ${tableNames.map(t => `"${t}"`).join(', ')} CASCADE`));
  } catch {
    // Fallback table-by-table delete
    for (const t of tableNames) {
      try {
        await db.execute(sql.raw(`DELETE FROM "${t}"`));
      } catch {
        // Table might not exist or already cleared
      }
    }
  }

  // Re-seed pristine demo data
  await seed();

  return {
    success: true,
    message: 'Demo database has been cleanly reset and re-seeded with demo accounts and khatas.',
  };
}

export async function seedScenario(scenario: 'new_request' | 'overdue_request') {
  // Find Rahul and Sharma store
  const rahul = await db.query.users.findFirst({
    where: and(eq(users.mobile, '8000000001'), eq(users.role, 'CUSTOMER')),
  });
  const sharma = await db.query.merchants.findFirst({
    where: eq(merchants.shopName, 'Sharma General Store'),
  });

  if (!rahul || !sharma) {
    throw new BadRequestError('Demo accounts not initialized. Please reset demo data first.');
  }

  const DAY = 24 * 60 * 60 * 1000;

  if (scenario === 'new_request') {
    // Creates a pending udhaar request waiting for merchant approval
    const u = await requestUdhaar(rahul.id, {
      merchantId: sharma.id,
      principalPaise: 45000, // ₹450
      note: 'Demo request: Fresh dairy, butter & bread',
      dueDate: new Date(Date.now() + 5 * DAY),
      items: [
        { name: 'Amul Butter 500g', qty: 1, pricePaise: 27500 },
        { name: 'Brown Bread', qty: 2, pricePaise: 10000 },
        { name: 'Full Cream Milk 1L', qty: 1, pricePaise: 7500 },
      ],
    });
    return { success: true, scenario, udhaarId: u.id, message: 'Created pending request for ₹450' };
  }

  if (scenario === 'overdue_request') {
    // Creates an accepted overdue request for Rahul at Sharma store
    const rajesh = await db.query.users.findFirst({
      where: and(eq(users.mobile, '9000000001'), eq(users.role, 'MERCHANT')),
    });
    const u = await requestUdhaar(rahul.id, {
      merchantId: sharma.id,
      principalPaise: 65000, // ₹650
      note: 'Overdue Demo: Spices, ghee & dry fruits',
      dueDate: new Date(Date.now() - 5 * DAY),
    });
    if (rajesh) {
      await acceptUdhaar(sharma.id, u.id, rajesh.id, 'MERCHANT');
    }
    return { success: true, scenario, udhaarId: u.id, message: 'Created overdue udhaar for ₹650' };
  }

  throw new BadRequestError(`Unknown scenario: ${scenario}`);
}
