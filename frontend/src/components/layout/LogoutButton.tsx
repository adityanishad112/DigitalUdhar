import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuth } from '@/store/auth';
import { useT } from '@/i18n';

/**
 * Header logout control for the phone frame's TopBar right slot. Styled to
 * match {@link NotificationBell} so it sits cleanly on the jade header.
 * Ensures every role (admin, merchant, staff) has a visible way to sign out.
 */
export function LogoutButton() {
  const navigate = useNavigate();
  const logout = useAuth((s) => s.logout);
  const { t } = useT();
  return (
    <button
      onClick={() => {
        logout();
        navigate('/', { replace: true });
      }}
      className="rounded-full p-1.5 transition hover:bg-white/15"
      aria-label={t('profile.logout')}
      title={t('profile.logout')}
    >
      <LogOut className="h-6 w-6" />
    </button>
  );
}
