import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UiState {
  /** Transient toast messages. */
  toasts: Toast[];
  pushToast: (t: Omit<Toast, 'id'>) => void;
  dismissToast: (id: number) => void;
}

export interface Toast {
  id: number;
  kind: 'success' | 'error' | 'info';
  message: string;
}

let toastId = 0;

export const useUi = create<UiState>((set) => ({
  toasts: [],
  pushToast: (t) => {
    const id = ++toastId;
    set((s) => ({ toasts: [...s.toasts, { ...t, id }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), 3500);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));

export type Lang = 'en' | 'hi' | 'hinglish';

interface LangState {
  lang: Lang;
  setLang: (l: Lang) => void;
}

export const useLang = create<LangState>()(
  persist(
    (set) => ({
      lang: 'en',
      setLang: (lang) => set({ lang }),
    }),
    { name: 'udhar.lang' },
  ),
);
