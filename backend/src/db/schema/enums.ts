/**
 * Shared enum-like union types. We store these as plain text columns (typed via
 * Drizzle's $type) instead of Postgres enum types — this keeps migrations simple
 * on PGlite and lets the app layer (zod) own validation.
 */

export const USER_ROLES = ['CUSTOMER', 'MERCHANT', 'STAFF', 'ADMIN'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ['ACTIVE', 'FROZEN', 'SUSPENDED'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const IDENTITY_STATUSES = ['UNVERIFIED', 'PENDING', 'VERIFIED', 'FAILED'] as const;
export type IdentityStatus = (typeof IDENTITY_STATUSES)[number];

export const IDENTITY_METHODS = ['AADHAAR', 'PAN', 'DL', 'PASSPORT'] as const;
export type IdentityMethod = (typeof IDENTITY_METHODS)[number];

export const LANGUAGES = ['en', 'hi', 'hinglish'] as const;
export type Language = (typeof LANGUAGES)[number];

export const MERCHANT_STATUSES = ['PENDING', 'ACTIVE', 'SUSPENDED'] as const;
export type MerchantStatus = (typeof MERCHANT_STATUSES)[number];

export const QR_STATUSES = ['ACTIVE', 'REVOKED'] as const;
export type QrStatus = (typeof QR_STATUSES)[number];

export const STAFF_PERMISSIONS = [
  'CREATE_BILL',
  'CREATE_UDHAAR',
  'PROCESS_PAYMENT',
  'VIEW_CUSTOMERS',
] as const;
export type StaffPermission = (typeof STAFF_PERMISSIONS)[number];

// Udhaar lifecycle (base). Schedule buckets (UPCOMING/DUE_TODAY/OVERDUE) and
// PROMISE_TO_PAY are derived at query time from due date + outstanding + promise.
export const UDHAAR_STATUSES = [
  'REQUESTED',
  'ACTIVE',
  'REJECTED',
  'CLEARED',
  'CANCELLED',
  'DISPUTED',
] as const;
export type UdhaarStatus = (typeof UDHAAR_STATUSES)[number];

// Derived schedule bucket used by the UI filters.
export const SCHEDULE_BUCKETS = [
  'UPCOMING',
  'DUE_TODAY',
  'OVERDUE',
  'PROMISE_TO_PAY',
  'PROMISE_MISSED',
  'CLEARED',
  'REQUESTED',
  'DISPUTED',
] as const;
export type ScheduleBucket = (typeof SCHEDULE_BUCKETS)[number];

export const LEDGER_TXN_TYPES = [
  'UDHAAR_CREATED',
  'REPAYMENT',
  'ADJUSTMENT',
  'REFUND',
  'OPENING_BALANCE',
] as const;
export type LedgerTxnType = (typeof LEDGER_TXN_TYPES)[number];

export const LEDGER_METHODS = ['DIGITAL', 'CASH', 'SYSTEM'] as const;
export type LedgerMethod = (typeof LEDGER_METHODS)[number];

export const PAYMENT_STATUSES = [
  'CREATED',
  'PENDING',
  'SUCCESS',
  'FAILED',
  'REFUNDED',
  'PARTIALLY_REFUNDED',
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_METHODS = ['UPI', 'CARD', 'NETBANKING', 'CASH'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const RECEIPT_TYPES = [
  'UDHAAR_CREATED',
  'REPAYMENT',
  'CASH_REPAYMENT',
  'REFUND',
  'ADJUSTMENT',
  'FULL_CLEARANCE',
] as const;
export type ReceiptType = (typeof RECEIPT_TYPES)[number];

export const PROMISE_STATUSES = ['PENDING', 'FULFILLED', 'MISSED', 'CANCELLED'] as const;
export type PromiseStatus = (typeof PROMISE_STATUSES)[number];

export const REMINDER_TYPES = [
  'BEFORE_3D',
  'BEFORE_1D',
  'DUE_DATE',
  'OVERDUE_1D',
  'OVERDUE_3D',
  'OVERDUE_WEEKLY',
] as const;
export type ReminderType = (typeof REMINDER_TYPES)[number];

export const REMINDER_STATUSES = ['SCHEDULED', 'SENT', 'CANCELLED'] as const;
export type ReminderStatus = (typeof REMINDER_STATUSES)[number];

export const NOTIFICATION_TYPES = [
  'UDHAAR_REQUESTED',
  'UDHAAR_ACCEPTED',
  'UDHAAR_REJECTED',
  'PAYMENT_RECEIVED',
  'PAYMENT_FAILED',
  'CASH_RECORDED',
  'REMINDER',
  'PROMISE_CREATED',
  'PROMISE_MISSED',
  'DISPUTE_UPDATE',
  'ADJUSTMENT',
  'REFUND',
  'UDHAAR_CLEARED',
  'SYSTEM',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const DISPUTE_CATEGORIES = [
  'WRONG_AMOUNT',
  'UNAUTHORIZED_UDHAAR',
  'DUPLICATE_TRANSACTION',
  'PAYMENT_MISSING',
  'WRONG_MERCHANT',
  'INCORRECT_REPAYMENT',
  'INCORRECT_DUE_DATE',
  'OTHER',
] as const;
export type DisputeCategory = (typeof DISPUTE_CATEGORIES)[number];

export const DISPUTE_STATUSES = [
  'OPEN',
  'UNDER_REVIEW',
  'WAITING_CUSTOMER',
  'WAITING_MERCHANT',
  'RESOLVED',
  'REJECTED',
] as const;
export type DisputeStatus = (typeof DISPUTE_STATUSES)[number];

export const SETTLEMENT_STATUSES = [
  'PENDING',
  'SETTLED',
  'FAILED',
  'REFUNDED',
] as const;
export type SettlementStatus = (typeof SETTLEMENT_STATUSES)[number];

export const FAMILY_PERMISSIONS = [
  'CAN_VIEW',
  'CAN_PAY',
  'CAN_CREATE_UDHAAR',
  'CAN_EDIT_ACCOUNT',
] as const;
export type FamilyPermission = (typeof FAMILY_PERMISSIONS)[number];
