import { useState } from 'react';
import { Check, Globe } from 'lucide-react';
import { useLang } from '@/store/ui';
import { LANGUAGES } from '@/i18n';
import { cn } from '@/lib/cn';
import { BottomSheet } from '@/components/ui/Modal';

/** Compact language toggle — opens a sheet to pick English / हिन्दी / Hinglish. */
export function LanguageSwitch({ variant = 'chip' }: { variant?: 'chip' | 'row' }) {
  const lang = useLang((s) => s.lang);
  const setLang = useLang((s) => s.setLang);
  const [open, setOpen] = useState(false);
  const current = LANGUAGES.find((l) => l.value === lang) ?? LANGUAGES[0];

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          variant === 'chip'
            ? 'inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur'
            : 'input flex items-center justify-between',
        )}
      >
        <span className="inline-flex items-center gap-1.5">
          <Globe className={cn('h-4 w-4', variant === 'row' && 'text-ink-400')} />
          {variant === 'chip' ? current.short : current.label}
        </span>
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)} title="Language / भाषा">
        <div className="flex flex-col gap-1">
          {LANGUAGES.map((l) => (
            <button
              key={l.value}
              onClick={() => {
                setLang(l.value);
                setOpen(false);
              }}
              className={cn(
                'flex items-center justify-between rounded-2xl px-4 py-3 text-left text-base font-medium transition',
                l.value === lang ? 'bg-brand-50 text-brand-700' : 'text-ink-700 hover:bg-ink-50',
              )}
            >
              {l.label}
              {l.value === lang && <Check className="h-5 w-5 text-brand-600" />}
            </button>
          ))}
        </div>
      </BottomSheet>
    </>
  );
}
