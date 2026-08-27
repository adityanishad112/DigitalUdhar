/**
 * Money helpers. The whole system stores money as INTEGER PAISE (1 rupee = 100
 * paise) to avoid floating-point errors. Rupees only appear at display edges.
 */

export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

export function paiseToRupees(paise: number): number {
  return paise / 100;
}

/** Format paise as an Indian-grouped rupee string, e.g. 150000 -> "₹1,500". */
export function formatINR(paise: number, opts: { decimals?: boolean } = {}): string {
  const negative = paise < 0;
  const abs = Math.abs(paise);
  const rupees = Math.floor(abs / 100);
  const paisePart = abs % 100;

  const grouped = groupIndian(rupees);
  let out = `₹${grouped}`;
  if (opts.decimals || paisePart !== 0) {
    out += `.${String(paisePart).padStart(2, '0')}`;
  }
  return negative ? `-${out}` : out;
}

/** Indian digit grouping: 1234567 -> "12,34,567". */
export function groupIndian(n: number): string {
  const s = String(n);
  if (s.length <= 3) return s;
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3);
  return rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3;
}

/** Guard: amounts must be positive whole paise within sane bounds. */
export function assertValidAmountPaise(paise: number): number {
  if (!Number.isInteger(paise)) {
    throw new Error('Amount must be an integer number of paise');
  }
  if (paise <= 0) {
    throw new Error('Amount must be greater than zero');
  }
  if (paise > 10_00_00_000 * 100) {
    throw new Error('Amount exceeds the maximum allowed');
  }
  return paise;
}
