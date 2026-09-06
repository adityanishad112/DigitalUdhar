/** API types mirroring the backend response shapes (see backend/src/modules/**). */

export type Role = 'CUSTOMER' | 'MERCHANT' | 'STAFF' | 'ADMIN';
export type Lang = 'en' | 'hi' | 'hinglish';

export interface IdentityInfo {
  status: 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'FAILED';
  method?: string | null;
  maskedValue?: string | null;
  verifiedAt?: string | null;
}

/** Shape returned by GET /auth/me and nested in verify-otp. */
export interface Me {
  id: string;
  mobile: string;
  role: Role;
  name: string | null;
  email?: string | null;
  status: string;
  mobileVerified: boolean;
  profile: {
    avatarUrl?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    pincode?: string | null;
    language?: Lang | null;
    notificationPrefs?: Record<string, boolean> | null;
  } | null;
  identity: IdentityInfo;
  merchant: { id: string; shopName: string; status: string } | null;
}

export interface AuthResult {
  token: string;
  user: Me;
  isNew: boolean;
}

export interface SendOtpResult {
  sent: boolean;
  devOtp?: string;
  expiresInSeconds: number;
}

export interface PublicMerchant {
  id: string;
  shopName: string;
  category?: string | null;
  description?: string | null;
  city?: string | null;
  state?: string | null;
  upiId?: string | null;
  status: string;
  defaultCreditLimitPaise: number;
  defaultTermsDays: number;
  defaultMaxTxnPaise: number;
}

export interface Merchant extends PublicMerchant {
  ownerUserId: string;
  legalName?: string | null;
  address?: string | null;
  pincode?: string | null;
  phone?: string | null;
  email?: string | null;
  gstin?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface MyAccount {
  outstandingPaise: number;
  creditLimitPaise: number;
  termsDays: number;
  hasRelationship: boolean;
  relationshipStatus: string | null;
}

export interface Qr {
  id: string;
  token: string;
  label: string | null;
  merchantId?: string;
  status?: string;
  payload?: string;
  createdAt?: string;
  revokedAt?: string | null;
}

export interface QrResolveResult {
  qr: { id: string; token: string; label: string | null };
  merchant: PublicMerchant;
  myAccount: MyAccount;
}

export interface UdhaarItem {
  name: string;
  qty?: number | null;
  pricePaise?: number | null;
}

/** Base udhaar row (udhaar.$inferSelect). Display id is `ref`. */
export interface Udhaar {
  id: string;
  ref: string;
  accountId: string;
  merchantId: string;
  customerUserId: string;
  createdByUserId: string;
  principalPaise: number;
  outstandingPaise: number;
  status: string;
  items?: UdhaarItem[] | null;
  note?: string | null;
  billRef?: string | null;
  dueDate: string;
  customerConfirmed: boolean;
  merchantConfirmed: boolean;
  limitExceeded: boolean;
  acceptedAt?: string | null;
  rejectedAt?: string | null;
  rejectedReason?: string | null;
  clearedAt?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface PromiseToPay {
  id: string;
  udhaarId: string;
  customerUserId: string;
  promisedDate: string;
  amountPaise: number;
  note?: string | null;
  status: string;
  fulfilledAt?: string | null;
  createdAt: string;
}

/** Customer khata list row: udhaar + shop name + derived bucket. */
export interface CustomerUdhaar extends Udhaar {
  shopName: string;
  merchantCity: string | null;
  bucket: string;
  pendingPromise: PromiseToPay | null;
}

/** Merchant khata list row: udhaar + customer identity + derived bucket. */
export interface MerchantUdhaar extends Udhaar {
  customerName: string | null;
  customerMobile: string;
  bucket: string;
  pendingPromise: PromiseToPay | null;
}

export interface UdhaarEvent {
  id: string;
  udhaarId: string;
  type: string;
  title: string;
  description?: string | null;
  amountPaise?: number | null;
  actorUserId?: string | null;
  actorRole?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface UdhaarDetail {
  udhaar: Udhaar & { bucket: string };
  events: UdhaarEvent[];
  promises: PromiseToPay[];
  merchant: { id: string; shopName: string; city: string | null; upiId: string | null } | null;
  customer: { id: string; name: string | null; mobile: string } | null;
  account: { outstandingPaise: number; totalUdhaarPaise: number; totalRepaidPaise: number } | null;
}

export interface Payment {
  id: string;
  ref: string;
  udhaarId: string;
  merchantId: string;
  customerUserId: string;
  amountPaise: number;
  method: string;
  status: string;
  feePaise?: number | null;
  netPaise?: number | null;
  refundedPaise?: number;
  gatewayOrderId: string;
  gatewayPaymentId?: string | null;
  createdAt: string;
}

export interface CreateOrderResult {
  payment: Payment;
  order: {
    gatewayOrderId: string;
    amountPaise: number;
    currency: string;
    keyId: string;
    provider: string;
  };
  idempotent: boolean;
}

export interface WebhookResult {
  status: 'PROCESSED' | 'DUPLICATE' | 'IGNORED' | 'ALREADY_FINAL';
  paymentId?: string;
  paymentStatus?: string;
  cleared?: boolean;
}

export interface SimulateResult {
  result: WebhookResult;
  gatewayPaymentId: string;
  eventId: string;
}

export interface VerifyPaymentResult {
  result: WebhookResult;
}

export interface LedgerTxn {
  id: string;
  accountId: string;
  udhaarId?: string | null;
  type: string;
  method?: string | null;
  amountPaise: number;
  balanceAfterPaise: number;
  description?: string | null;
  createdAt: string;
}

export interface MerchantCustomerRow {
  customerUserId: string;
  name: string | null;
  mobile: string;
  creditLimitPaise: number | null;
  termsDays: number | null;
  status: string;
  outstandingPaise: number;
  totalUdhaarPaise: number;
  totalRepaidPaise: number;
}

export interface MerchantReport {
  totalOutstandingPaise: number;
  totalUdhaarPaise: number;
  totalRepaidPaise: number;
  collectionsThisMonthPaise: number;
  overdueAmountPaise: number;
  collectionRatePct: number;
  customerCount: number;
  counts: {
    total: number;
    requested: number;
    active: number;
    cleared: number;
    rejected: number;
    disputed: number;
    overdue: number;
    dueToday: number;
  };
  topDebtors: { customerUserId: string; name: string; mobile: string | null; outstandingPaise: number }[];
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body?: string | null;
  data?: Record<string, unknown> | null;
  read: boolean;
  readAt?: string | null;
  createdAt: string;
}

export interface AdminOverview {
  users: { total: number; byRole: Record<string, number>; frozenOrSuspended: number };
  merchants: { total: number; byStatus: Record<string, number> };
  udhaar: { total: number; byStatus: Record<string, number> };
  payments: { total: number; byStatus: Record<string, number> };
  money: { totalOutstandingPaise: number; totalUdhaarVolumePaise: number; totalCollectedPaise: number };
  openDisputes: number;
}

export interface AdminUser {
  id: string;
  mobile: string;
  name: string | null;
  role: Role;
  status: string;
  frozenReason?: string | null;
  createdAt: string;
  lastLoginAt?: string | null;
}

export interface AdminMerchant {
  id: string;
  shopName: string;
  city: string | null;
  status: string;
  ownerUserId: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  actorUserId?: string | null;
  actorRole?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  summary?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface Dispute {
  id: string;
  udhaarId: string;
  category: string;
  status: string;
  description?: string | null;
  amountClaimedPaise?: number | null;
  createdAt: string;
}

export interface DemoAccount {
  role: Role;
  mobile: string;
  name: string;
  label: string;
  description: string;
  badge: string;
  shopName?: string;
  qrToken?: string;
  qrUrl?: string;
  city?: string;
  category?: string;
  userId?: string | null;
}

export interface DemoAccountsResponse {
  accounts: DemoAccount[];
  stats: {
    totalUdhaars: number;
  };
  demoReady: boolean;
}

