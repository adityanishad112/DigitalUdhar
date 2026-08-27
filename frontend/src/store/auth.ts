import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { setAuthToken, setUnauthorizedHandler } from '@/lib/api';
import type { Me, Role } from '@/lib/types';

interface AuthState {
  token: string | null;
  user: Me | null;
  /** Role the user chose at login — drives which dashboard they land on. */
  setSession: (token: string, user: Me) => void;
  updateUser: (patch: Partial<Me>) => void;
  logout: () => void;
  isAuthed: () => boolean;
  hasRole: (...roles: Role[]) => boolean;
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      setSession: (token, user) => {
        setAuthToken(token);
        set({ token, user });
      },
      updateUser: (patch) => set((s) => ({ user: s.user ? { ...s.user, ...patch } : s.user })),
      logout: () => {
        setAuthToken(null);
        set({ token: null, user: null });
      },
      isAuthed: () => Boolean(get().token && get().user),
      hasRole: (...roles) => {
        const r = get().user?.role;
        return r ? roles.includes(r) : false;
      },
    }),
    {
      name: 'udhar.auth',
      onRehydrateStorage: () => (state) => {
        // Re-arm the axios client with the persisted token on reload.
        if (state?.token) setAuthToken(state.token);
      },
    },
  ),
);

// When any request 401s, drop the session so the router bounces to /login.
setUnauthorizedHandler(() => {
  useAuth.getState().logout();
});
