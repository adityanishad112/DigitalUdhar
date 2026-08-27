import { and, desc, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { familyPermissions, users } from '../../db/schema';
import type { FamilyPermission } from '../../db/schema/enums';
import { ForbiddenError, NotFoundError } from '../../core/errors';

export async function listFamily(ownerUserId: string) {
  return db
    .select()
    .from(familyPermissions)
    .where(eq(familyPermissions.ownerUserId, ownerUserId))
    .orderBy(desc(familyPermissions.createdAt));
}

export async function addFamilyMember(
  ownerUserId: string,
  input: { memberMobile: string; memberName?: string; permissions: FamilyPermission[] },
) {
  // Link to an existing customer account if one exists for that mobile.
  const [member] = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(and(eq(users.mobile, input.memberMobile), eq(users.role, 'CUSTOMER')))
    .limit(1);

  const [existing] = await db
    .select()
    .from(familyPermissions)
    .where(
      and(
        eq(familyPermissions.ownerUserId, ownerUserId),
        eq(familyPermissions.memberMobile, input.memberMobile),
      ),
    )
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(familyPermissions)
      .set({
        permissions: input.permissions,
        memberName: input.memberName ?? existing.memberName,
        memberUserId: member?.id ?? existing.memberUserId,
        status: 'ACTIVE',
        updatedAt: new Date(),
      })
      .where(eq(familyPermissions.id, existing.id))
      .returning();
    return updated;
  }

  const [row] = await db
    .insert(familyPermissions)
    .values({
      ownerUserId,
      memberUserId: member?.id ?? null,
      memberMobile: input.memberMobile,
      memberName: input.memberName ?? member?.name ?? null,
      permissions: input.permissions,
      status: 'ACTIVE',
    })
    .returning();
  return row;
}

async function ownedRow(ownerUserId: string, id: string) {
  const [row] = await db.select().from(familyPermissions).where(eq(familyPermissions.id, id)).limit(1);
  if (!row) throw new NotFoundError('Family member not found');
  if (row.ownerUserId !== ownerUserId) throw new ForbiddenError('Not your family member');
  return row;
}

export async function updateFamilyMember(
  ownerUserId: string,
  id: string,
  input: { permissions?: FamilyPermission[]; status?: 'ACTIVE' | 'REVOKED' },
) {
  await ownedRow(ownerUserId, id);
  const [updated] = await db
    .update(familyPermissions)
    .set({
      ...(input.permissions ? { permissions: input.permissions } : {}),
      ...(input.status ? { status: input.status } : {}),
      updatedAt: new Date(),
    })
    .where(eq(familyPermissions.id, id))
    .returning();
  return updated;
}

export async function removeFamilyMember(ownerUserId: string, id: string) {
  await ownedRow(ownerUserId, id);
  await db
    .update(familyPermissions)
    .set({ status: 'REVOKED', updatedAt: new Date() })
    .where(eq(familyPermissions.id, id));
  return { id, status: 'REVOKED' as const };
}
