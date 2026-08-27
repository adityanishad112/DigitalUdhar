import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { Money } from '@/components/ui/Money';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { bucketStatus } from '@/lib/status';
import { dueLabel } from '@/lib/dates';
import { cn } from '@/lib/cn';

const toneText: Record<string, string> = {
  green: 'text-emerald-600',
  amber: 'text-amber-600',
  red: 'text-rose-600',
  blue: 'text-sky-600',
  gray: 'text-ink-400',
};

/**
 * One khata/udhaar line. All monetary + status values come straight from the
 * API row — this component only formats and links.
 */
export function UdhaarRow({
  to,
  title,
  subtitle,
  outstandingPaise,
  principalPaise,
  bucket,
  status,
  dueDate,
  refNo,
}: {
  to: string;
  title: string;
  subtitle?: string | null;
  outstandingPaise: number;
  principalPaise: number;
  bucket: string;
  status: string;
  dueDate: string;
  refNo?: string;
}) {
  const cleared = status === 'CLEARED' || outstandingPaise === 0;
  const showDue = !cleared && status === 'ACTIVE';
  const due = dueLabel(dueDate);

  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3.5 shadow-soft transition active:scale-[0.99]"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-semibold text-ink-900">{title}</p>
          <StatusBadge meta={bucketStatus(bucket)} dot={false} />
        </div>
        {subtitle && <p className="mt-0.5 truncate text-sm text-ink-500">{subtitle}</p>}
        {showDue && (
          <p className={cn('mt-0.5 text-xs font-medium', toneText[due.tone] ?? 'text-ink-400')}>{due.text}</p>
        )}
        {refNo && <p className="mt-0.5 text-[11px] font-medium text-ink-300">{refNo}</p>}
      </div>
      <div className="text-right">
        <Money paise={cleared ? 0 : outstandingPaise} tone={cleared ? 'paid' : 'due'} />
        {!cleared && principalPaise !== outstandingPaise && (
          <p className="text-[11px] text-ink-400">of ₹{(principalPaise / 100).toLocaleString('en-IN')}</p>
        )}
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-ink-300" />
    </Link>
  );
}
