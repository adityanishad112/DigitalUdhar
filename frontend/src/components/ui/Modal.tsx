import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Mobile-first bottom sheet. Slides up from the bottom, backdrop click + Esc
 * to dismiss. Constrained to the phone-width column so it looks native.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-ink-900/40 animate-fade-in" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-md animate-slide-up rounded-t-4xl bg-white p-5 pb-8 shadow-card-lg"
      >
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-ink-200" />
        {title && (
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-bold text-ink-900">{title}</h2>
            <button
              onClick={onClose}
              className="rounded-full p-1.5 text-ink-400 transition hover:bg-ink-100 hover:text-ink-600"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
        <div className="max-h-[70vh] overflow-y-auto">{children}</div>
        {footer && <div className="mt-5">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/** Centered modal for confirmations. */
export function Modal({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-ink-900/40 animate-fade-in" onClick={onClose} aria-hidden />
      <div role="dialog" aria-modal="true" className={cn('relative w-full max-w-sm animate-scale-in card p-5', className)}>
        {title && <h2 className="mb-3 font-display text-lg font-bold text-ink-900">{title}</h2>}
        {children}
      </div>
    </div>,
    document.body,
  );
}
