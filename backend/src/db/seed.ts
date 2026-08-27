import { and, eq } from 'drizzle-orm';
import { db } from './client';
import {
  identityVerifications,
  merchants,
  qrCodes,
  userProfiles,
  users,
} from './schema';
import type { UserRole } from './schema/enums';
import { logger } from '../core/logger';
import { registerMerchant } from '../modules/merchants/service';
import { acceptUdhaar, requestUdhaar } from '../modules/udhaar/service';

const DAY = 24 * 60 * 60 * 1000;

async function ensureUser(mobile: string, role: UserRole, name: string) {
  const existing = await db.query.users.findFirst({
    where: and(eq(users.mobile, mobile), eq(users.role, role)),
  });
  if (existing) return existing;

  return db.transaction(async (tx) => {
    const [u] = await tx
      .insert(users)
      .values({ mobile, role, name, mobileVerified: true })
      .returning();
    await tx.insert(userProfiles).values({ userId: u.id, city: 'Kanpur', state: 'Uttar Pradesh' });
    await tx.insert(identityVerifications).values({ userId: u.id, status: 'UNVERIFIED' });
    return u;
  });
}

/**
 * Idempotent demo seed. Safe to run on every boot — it checks for the admin
 * user and returns early if the data is already present.
 */
export async function seed(): Promise<{ seeded: boolean }> {
  const adminMobile = '9999900000';
  const already = await db.query.users.findFirst({
    where: and(eq(users.mobile, adminMobile), eq(users.role, 'ADMIN')),
  });
  if (already) {
    logger.info('Seed skipped — demo data already present.');
    return { seeded: false };
  }

  logger.info('Seeding demo data…');

  // --- People -------------------------------------------------------------
  await ensureUser(adminMobile, 'ADMIN', 'Platform Admin');
  const rajesh = await ensureUser('9000000001', 'MERCHANT', 'Rajesh Sharma');
  const suresh = await ensureUser('9000000002', 'MERCHANT', 'Suresh Gupta');
  const rahul = await ensureUser('8000000001', 'CUSTOMER', 'Rahul Kumar');

  // --- Shops --------------------------------------------------------------
  const sharma = await registerMerchant(rajesh.id, {
    shopName: 'Sharma General Store',
    legalName: 'Sharma Kirana & Provisions',
    category: 'Kirana / Grocery',
    description: 'Daily needs, grains, and household provisions.',
    address: 'Shop 12, Gumti No. 5',
    city: 'Kanpur',
    state: 'Uttar Pradesh',
    pincode: '208001',
    phone: '9000000001',
    upiId: 'sharmastore@upi',
  });

  const gupta = await registerMerchant(suresh.id, {
    shopName: 'Gupta General Store',
    category: 'Kirana / Grocery',
    description: 'Snacks, cold drinks, and everyday essentials.',
    city: 'Kanpur',
    state: 'Uttar Pradesh',
    upiId: 'guptastore@upi',
  });

  // --- Demo udhaar (real service flow → real ledger + receipts + timeline) --
  // 1) Rahul @ Sharma: ₹1,500 active, due in 10 days (upcoming).
  const u1 = await requestUdhaar(rahul.id, {
    merchantId: sharma.id,
    principalPaise: 150000,
    note: 'Monthly grocery — rice, atta, oil, dal',
    dueDate: new Date(Date.now() + 10 * DAY),
    items: [
      { name: 'Rice 10kg', qty: 1, pricePaise: 60000 },
      { name: 'Atta 10kg', qty: 1, pricePaise: 45000 },
      { name: 'Cooking oil 5L', qty: 1, pricePaise: 45000 },
    ],
  });
  await acceptUdhaar(sharma.id, u1.id, rajesh.id, 'MERCHANT');

  // 2) Rahul @ Sharma: ₹800 active, due 3 days ago (overdue — triggers a reminder).
  const u2 = await requestUdhaar(rahul.id, {
    merchantId: sharma.id,
    principalPaise: 80000,
    note: 'Tea, sugar, biscuits',
    dueDate: new Date(Date.now() - 3 * DAY),
  });
  await acceptUdhaar(sharma.id, u2.id, rajesh.id, 'MERCHANT');

  // 3) Rahul @ Gupta: ₹300 active (privacy: Sharma must never see this).
  const u3 = await requestUdhaar(rahul.id, {
    merchantId: gupta.id,
    principalPaise: 30000,
    note: 'Cold drinks & snacks',
    dueDate: new Date(Date.now() + 7 * DAY),
  });
  await acceptUdhaar(gupta.id, u3.id, suresh.id, 'MERCHANT');

  // Grab the shop counter QR tokens for the login banner.
  const [sharmaQr] = await db.select().from(qrCodes).where(eq(qrCodes.merchantId, sharma.id)).limit(1);

  logger.info('──────────────────────────────────────────────');
  logger.info('  Digital Udhar — demo data ready');
  logger.info('  Login with OTP (dev OTP is returned by the API):');
  logger.info(`    Customer : 8000000001  (Rahul Kumar)`);
  logger.info(`    Merchant : 9000000001  (Rajesh Sharma — Sharma General Store)`);
  logger.info(`    Merchant : 9000000002  (Suresh Gupta — Gupta General Store)`);
  logger.info(`    Admin    : 9999900000`);
  if (sharmaQr) logger.info(`  Sharma counter QR token: ${sharmaQr.token}`);
  logger.info('──────────────────────────────────────────────');

  return { seeded: true };
}

// Allow running as a standalone script: `tsx src/db/seed.ts`
const invokedDirectly =
  process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('src/db/seed.ts');

if (invokedDirectly) {
  Promise.resolve()
    .then(async () => {
      const { runMigrations } = await import('./migrate');
      const { pglite } = await import('./client');
      await runMigrations();
      await seed();
      await pglite.close();
      process.exit(0);
    })
    .catch((err) => {
      logger.error('Seed failed', err);
      process.exit(1);
    });
}
