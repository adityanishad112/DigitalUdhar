import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** Standard scrollable content padding for a page under the TopBar. */
export function PageBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('space-y-4 px-4 py-4', className)}>{children}</div>;
}
