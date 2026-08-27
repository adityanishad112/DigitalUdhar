import { cn } from '@/lib/cn';
import { formatINR } from '@/lib/money';

type MoneySize = 'sm' | 'md' | 'lg' | 'xl' | '2xl';

const sizeClass: Record<MoneySize, string> = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-xl',
  xl: 'text-3xl',
  '2xl': 'text-4xl',
};

/**
 * Displays a money amount. The value MUST be integer paise coming straight
 * from an API response — the frontend never computes balances, it only formats.
 */
export function Money({
  paise,
  size = 'md',
  className,
  tone,
  strong = true,
}: {
  paise: number;
  size?: MoneySize;
  className?: string;
  /** 'due' = outstanding (ink), 'paid' = cleared/green, 'muted' = grey. */
  tone?: 'due' | 'paid' | 'muted' | 'accent';
  strong?: boolean;
}) {
  const toneClass =
    tone === 'paid'
      ? 'text-emerald-600'
      : tone === 'muted'
        ? 'text-ink-500'
        : tone === 'accent'
          ? 'text-accent-600'
          : 'text-ink-900';
  return (
    <span
      className={cn(
        'tnum whitespace-nowrap font-display',
        strong && 'font-bold',
        sizeClass[size],
        toneClass,
        className,
      )}
    >
      {formatINR(paise)}
    </span>
  );
}
