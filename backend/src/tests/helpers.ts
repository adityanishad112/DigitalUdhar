import { and, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { runMigrations } from '../db/migrate';
import { identityVerifications, userProfiles, users } from '../db/schema';
import type { UserRole } from '../db/schema/enums';
import { registerMerchant } from '../modules/merchants/service';

let migrated = false;

/** Ensure the in-memory schema exists (idempotent across test files). */
export async function ensureSchema() {
  if (migrated) return;
  await runMigrations();
  migrated = true;
}

let seq = 0;
/** A unique-ish 10-digit mobile per call so tests never collide on (mobile,role). */
export function uniqueMobile(prefix = '7') {
  seq += 1;
  return (prefix + String(100000000 + seq)).slice(0, 10);
}

export async function makeUser(role: UserRole, name: string, mobile = uniqueMobile()) {
  const existing = await db.query.users.findFirst({
    where: and(eq(users.mobile, mobile), eq(users.role, role)),
  });
  if (existing) return existing;
  return db.transaction(async (tx) => {
    const [u] = await tx.insert(users).values({ mobile, role, name, mobileVerified: true }).returning();
    await tx.insert(userProfiles).values({ userId: u.id });
    await tx.insert(identityVerifications).values({ userId: u.id, status: 'UNVERIFIED' });
    return u;
  });
}

/** A merchant owner + their shop, ready to accept udhaar. */
export async function makeShop(shopName: string, overrides: Record<string, unknown> = {}) {
  const owner = await makeUser('MERCHANT', `${shopName} Owner`);
  const merchant = await registerMerchant(owner.id, { shopName, ...overrides });
  return { owner, merchant };
}
