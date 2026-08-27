/**
 * Money helpers. The backend is the single source of truth and always sends
 * integer paise. The frontend NEVER does financial arithmetic for display of a
 * balance — it only formats what the API returned. The only place we build a
 * paise value is when composing a user's *input* amount to send back up.
 */

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

/** Format integer paise from the API as "₹1,500" / "₹12,340.50". */
export function formatINR(paise: number | null | undefined): string {
  const p = typeof paise === 'number' && Number.isFinite(paise) ? paise : 0;
  const rupees = p / 100;
  // Drop the ".00" tail for whole-rupee amounts; keep paise when present.
  return Number.isInteger(rupees)
    ? inr.format(rupees).replace(/\.00$/, '')
    : inr.format(rupees);
}

/** Plain grouped number without the symbol — for inline use ("1,500"). */
export function formatAmount(paise: number | null | undefined): string {
  return formatINR(paise).replace('₹', '').trim();
}

/**
 * Convert a rupee string typed by a user into integer paise for the API.
 * Rounds to the nearest paisa so "199.999" can't smuggle sub-paise noise in.
 */
export function rupeesToPaise(input: string | number): number {
  const n = typeof input === 'number' ? input : Number(String(input).replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

/** Paise → editable rupee string ("150000" → "1500"). */
export function paiseToRupees(paise: number): string {
  const r = paise / 100;
  return Number.isInteger(r) ? String(r) : r.toFixed(2);
}
