import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { pk, timestamps } from './_shared';
import type {
  FamilyPermission,
  IdentityMethod,
  IdentityStatus,
  Language,
  UserRole,
  UserStatus,
} from './enums';

export const users = pgTable(
  'users',
  {
    id: pk(),
    mobile: text('mobile').notNull(),
    role: text('role').$type<UserRole>().notNull(),
    name: text('name'),
    email: text('email'),
    passwordHash: text('password_hash'),
    status: text('status').$type<UserStatus>().notNull().default('ACTIVE'),
    mobileVerified: boolean('mobile_verified').notNull().default(false),
    frozenReason: text('frozen_reason'),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [uniqueIndex('users_mobile_role_uq').on(t.mobile, t.role)],
);

export const userProfiles = pgTable('user_profiles', {
  id: pk(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' })
    .unique(),
  avatarUrl: text('avatar_url'),
  address: text('address'),
  city: text('city'),
  state: text('state'),
  pincode: text('pincode'),
  language: text('language').$type<Language>().notNull().default('en'),
  // { reminders: {before3d,before1d,dueDate,overdue1d,overdue3d,weekly}, channels: {...} }
  notificationPrefs: jsonb('notification_prefs').$type<Record<string, unknown>>(),
  ...timestamps(),
});

export const identityVerifications = pgTable('identity_verifications', {
  id: pk(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' })
    .unique(),
  status: text('status').$type<IdentityStatus>().notNull().default('UNVERIFIED'),
  method: text('method').$type<IdentityMethod>(),
  provider: text('provider'),
  reference: text('reference'),
  // AES-256-GCM blob of the full government id — NEVER returned to merchants.
  encryptedData: text('encrypted_data'),
  maskedValue: text('masked_value'),
  consentGiven: boolean('consent_given').notNull().default(false),
  consentAt: timestamp('consent_at', { withTimezone: true }),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  ...timestamps(),
});

export const otpCodes = pgTable(
  'otp_codes',
  {
    id: pk(),
    mobile: text('mobile').notNull(),
    role: text('role').$type<UserRole>().notNull(),
    codeHash: text('code_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    attempts: integer('attempts').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('otp_mobile_idx').on(t.mobile)],
);

export const familyPermissions = pgTable(
  'family_permissions',
  {
    id: pk(),
    ownerUserId: text('owner_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    memberUserId: text('member_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    memberMobile: text('member_mobile').notNull(),
    memberName: text('member_name'),
    permissions: jsonb('permissions').$type<FamilyPermission[]>().notNull().default([]),
    status: text('status').$type<'ACTIVE' | 'REVOKED'>().notNull().default('ACTIVE'),
    ...timestamps(),
  },
  (t) => [index('family_owner_idx').on(t.ownerUserId)],
);
