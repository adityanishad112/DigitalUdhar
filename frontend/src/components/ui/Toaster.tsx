import { createPortal } from 'react-dom';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useUi } from '@/store/ui';
import { cn } from '@/lib/cn';

const kindMeta = {
  success: { icon: CheckCircle2, ring: 'ring-emerald-100', text: 'text-emerald-600' },
  error: { icon: XCircle, ring: 'ring-rose-100', text: 'text-rose-600' },
  info: { icon: Info, ring: 'ring-sky-100', text: 'text-sky-600' },
} as const;

export function Toaster() {
  const toasts = useUi((s) => s.toasts);
  const dismiss = useUi((s) => s.dismissToast);

  if (!toasts.length) return null;

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] mx-auto flex max-w-md flex-col gap-2 px-4">
      {toasts.map((t) => {
        const meta = kindMeta[t.kind] ?? kindMeta.info;
        const Icon = meta.icon;
        return (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto flex animate-slide-up items-start gap-3 rounded-2xl bg-white px-4 py-3 shadow-card-lg ring-1',
              meta.ring,
            )}
          >
            <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', meta.text)} />
            <p className="flex-1 text-sm font-medium text-ink-800">{t.message}</p>
            <button onClick={() => dismiss(t.id)} className="text-ink-300 transition hover:text-ink-500" aria-label="Dismiss">
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>,
    document.body,
  );
}
