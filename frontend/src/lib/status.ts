/**
 * Maps backend status enums to display labels + a visual "tone".
 * Enum values mirror backend/src/db/schema/enums.ts exactly.
 */
export type Tone = 'green' | 'amber' | 'red' | 'blue' | 'gray' | 'violet';

type StatusMeta = { label: string; tone: Tone };

// udhaar.status (base lifecycle)
const UDHAAR: Record<string, StatusMeta> = {
  REQUESTED: { label: 'Awaiting approval', tone: 'amber' },
  ACTIVE: { label: 'Active', tone: 'blue' },
  CLEARED: { label: 'Cleared', tone: 'green' },
  REJECTED: { label: 'Rejected', tone: 'red' },
  CANCELLED: { label: 'Cancelled', tone: 'gray' },
  DISPUTED: { label: 'Disputed', tone: 'violet' },
};

// Derived schedule bucket (computed by the API from due date + promise).
const BUCKET: Record<string, StatusMeta> = {
  UPCOMING: { label: 'Upcoming', tone: 'green' },
  DUE_TODAY: { label: 'Due today', tone: 'amber' },
  OVERDUE: { label: 'Overdue', tone: 'red' },
  PROMISE_TO_PAY: { label: 'Promised', tone: 'blue' },
  PROMISE_MISSED: { label: 'Promise missed', tone: 'red' },
  CLEARED: { label: 'Cleared', tone: 'green' },
  REQUESTED: { label: 'Awaiting approval', tone: 'amber' },
  DISPUTED: { label: 'Disputed', tone: 'violet' },
};

const PAYMENT: Record<string, StatusMeta> = {
  CREATED: { label: 'Started', tone: 'gray' },
  PENDING: { label: 'Pending', tone: 'amber' },
  SUCCESS: { label: 'Success', tone: 'green' },
  FAILED: { label: 'Failed', tone: 'red' },
  REFUNDED: { label: 'Refunded', tone: 'violet' },
  PARTIALLY_REFUNDED: { label: 'Partially refunded', tone: 'violet' },
};

const DISPUTE: Record<string, StatusMeta> = {
  OPEN: { label: 'Open', tone: 'amber' },
  UNDER_REVIEW: { label: 'Under review', tone: 'blue' },
  WAITING_CUSTOMER: { label: 'Waiting on customer', tone: 'amber' },
  WAITING_MERCHANT: { label: 'Waiting on shop', tone: 'amber' },
  RESOLVED: { label: 'Resolved', tone: 'green' },
  REJECTED: { label: 'Rejected', tone: 'red' },
};

const PROMISE: Record<string, StatusMeta> = {
  PENDING: { label: 'Promised', tone: 'blue' },
  FULFILLED: { label: 'Kept', tone: 'green' },
  MISSED: { label: 'Missed', tone: 'red' },
  CANCELLED: { label: 'Cancelled', tone: 'gray' },
};

function pick(map: Record<string, StatusMeta>, key: string | null | undefined): StatusMeta {
  if (!key) return { label: '—', tone: 'gray' };
  return map[key] ?? { label: key.replace(/_/g, ' ').toLowerCase(), tone: 'gray' };
}

export const udhaarStatus = (s?: string | null) => pick(UDHAAR, s);
export const bucketStatus = (s?: string | null) => pick(BUCKET, s);
export const paymentStatus = (s?: string | null) => pick(PAYMENT, s);
export const disputeStatus = (s?: string | null) => pick(DISPUTE, s);
export const promiseStatus = (s?: string | null) => pick(PROMISE, s);

/** Ledger transaction type → human label + whether it increases the balance. */
export function ledgerTypeMeta(type: string): { label: string; increases: boolean } {
  const map: Record<string, { label: string; increases: boolean }> = {
    UDHAAR_CREATED: { label: 'Udhaar taken', increases: true },
    REPAYMENT: { label: 'Repayment', increases: false },
    REFUND: { label: 'Refund', increases: true },
    ADJUSTMENT: { label: 'Adjustment', increases: true },
    OPENING_BALANCE: { label: 'Opening balance', increases: true },
  };
  return map[type] ?? { label: type.replace(/_/g, ' '), increases: true };
}

/** Evidence-timeline event type → label + tone dot. */
export function eventMeta(type: string): StatusMeta {
  const map: Record<string, StatusMeta> = {
    REQUESTED: { label: 'Requested', tone: 'amber' },
    ACCEPTED: { label: 'Accepted', tone: 'blue' },
    REJECTED: { label: 'Rejected', tone: 'red' },
    REPAYMENT: { label: 'Repayment', tone: 'green' },
    CASH_REPAYMENT: { label: 'Cash repayment', tone: 'green' },
    CLEARED: { label: 'Cleared', tone: 'green' },
    PROMISE_CREATED: { label: 'Promise to pay', tone: 'blue' },
    ADJUSTMENT: { label: 'Adjustment', tone: 'violet' },
    REFUND: { label: 'Refund', tone: 'violet' },
    DISPUTE_RAISED: { label: 'Dispute raised', tone: 'red' },
    DISPUTE_RESOLVED: { label: 'Dispute resolved', tone: 'green' },
  };
  return map[type] ?? { label: type.replace(/_/g, ' '), tone: 'gray' };
}
