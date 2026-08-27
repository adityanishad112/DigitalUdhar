import { Badge } from './Badge';
import type { Tone } from '@/lib/status';

/** Renders a status meta ({ label, tone }) from lib/status as a dotted badge. */
export function StatusBadge({
  meta,
  dot = true,
  className,
}: {
  meta: { label: string; tone: Tone };
  dot?: boolean;
  className?: string;
}) {
  return (
    <Badge tone={meta.tone} dot={dot} className={className}>
      {meta.label}
    </Badge>
  );
}
