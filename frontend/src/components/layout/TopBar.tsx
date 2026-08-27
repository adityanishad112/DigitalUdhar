import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Brand header for the phone frame. Jade gradient, optional back button,
 * a title, and a right-hand slot (bell, language switch, etc.).
 */
export function TopBar({
  title,
  subtitle,
  back,
  right,
  onBack,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  back?: boolean;
  right?: ReactNode;
  onBack?: () => void;
  className?: string;
}) {
  const navigate = useNavigate();
  return (
    <header
      className={cn(
        'sticky top-0 z-30 bg-gradient-to-br from-brand-600 to-brand-500 px-4 pb-4 pt-5 text-white shadow-soft',
        className,
      )}
    >
      <div className="flex items-center gap-3">
        {back && (
          <button
            onClick={() => (onBack ? onBack() : navigate(-1))}
            className="-ml-1.5 rounded-full p-1.5 transition hover:bg-white/15"
            aria-label="Back"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-lg font-bold leading-tight">{title}</h1>
          {subtitle && <p className="truncate text-sm text-white/80">{subtitle}</p>}
        </div>
        {right}
      </div>
    </header>
  );
}
