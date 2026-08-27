import { format, formatDistanceToNowStrict, differenceInCalendarDays, isValid } from 'date-fns';

function toDate(value: string | number | Date | null | undefined): Date | null {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(value);
  return isValid(d) ? d : null;
}

/** "26 Aug 2026" */
export function formatDate(value: string | number | Date | null | undefined): string {
  const d = toDate(value);
  return d ? format(d, 'dd MMM yyyy') : '—';
}

/** "26 Aug 2026, 3:40 PM" */
export function formatDateTime(value: string | number | Date | null | undefined): string {
  const d = toDate(value);
  return d ? format(d, 'dd MMM yyyy, h:mm a') : '—';
}

/** "3 hours ago" / "in 5 days" */
export function fromNow(value: string | number | Date | null | undefined): string {
  const d = toDate(value);
  if (!d) return '—';
  return formatDistanceToNowStrict(d, { addSuffix: true });
}

/**
 * A short human label for a due date relative to today.
 * Returns the label plus a tone so callers can colour it consistently.
 */
export function dueLabel(value: string | number | Date | null | undefined): {
  text: string;
  tone: 'green' | 'amber' | 'red' | 'gray';
  days: number | null;
} {
  const d = toDate(value);
  if (!d) return { text: 'No due date', tone: 'gray', days: null };
  const days = differenceInCalendarDays(d, new Date());
  if (days < 0) return { text: `Overdue by ${Math.abs(days)}d`, tone: 'red', days };
  if (days === 0) return { text: 'Due today', tone: 'amber', days };
  if (days <= 3) return { text: `Due in ${days}d`, tone: 'amber', days };
  return { text: `Due ${formatDate(d)}`, tone: 'green', days };
}
