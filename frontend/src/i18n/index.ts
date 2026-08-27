import { useCallback } from 'react';
import { useLang, type Lang } from '@/store/ui';
import { en, type I18nKey } from './en';
import { hi } from './hi';
import { hinglish } from './hinglish';

const DICTS: Record<Lang, Partial<Record<I18nKey, string>>> = {
  en,
  hi,
  hinglish,
};

export const LANGUAGES: { value: Lang; label: string; short: string }[] = [
  { value: 'en', label: 'English', short: 'EN' },
  { value: 'hi', label: 'हिन्दी', short: 'हि' },
  { value: 'hinglish', label: 'Hinglish', short: 'Hi' },
];

/** Interpolate {placeholders} from a params object. */
function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) => (k in params ? String(params[k]) : `{${k}}`));
}

export function translate(lang: Lang, key: I18nKey, params?: Record<string, string | number>): string {
  const value = DICTS[lang]?.[key] ?? en[key] ?? key;
  return interpolate(value, params);
}

/** Hook returning a `t()` bound to the current language. */
export function useT() {
  const lang = useLang((s) => s.lang);
  const t = useCallback(
    (key: I18nKey, params?: Record<string, string | number>) => translate(lang, key, params),
    [lang],
  );
  return { t, lang };
}

export type { I18nKey };
