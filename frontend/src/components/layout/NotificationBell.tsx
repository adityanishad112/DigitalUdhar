import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useUnreadCount } from '@/services/hooks';
import { useAuth } from '@/store/auth';

/** Base path for the notifications screen for the current role. */
export function notificationsPathFor(role: string | undefined): string {
  if (role === 'MERCHANT' || role === 'STAFF') return '/merchant/notifications';
  if (role === 'ADMIN') return '/admin/notifications';
  return '/app/notifications';
}

/** Header bell showing the live unread-notification count. */
export function NotificationBell() {
  const role = useAuth((s) => s.user?.role);
  const { data } = useUnreadCount();
  const count = data?.count ?? 0;
  return (
    <Link
      to={notificationsPathFor(role)}
      className="relative rounded-full p-1.5 transition hover:bg-white/15"
      aria-label="Notifications"
    >
      <Bell className="h-6 w-6" />
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-500 px-1 text-[10px] font-bold text-white ring-2 ring-brand-600">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </Link>
  );
}
