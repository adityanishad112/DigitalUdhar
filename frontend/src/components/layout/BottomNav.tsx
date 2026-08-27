import { NavLink } from 'react-router-dom';
import {
  BookOpen,
  Home,
  Inbox,
  LayoutDashboard,
  QrCode,
  ScanLine,
  ScrollText,
  ShieldCheck,
  User,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from '@/store/auth';
import { useT, type I18nKey } from '@/i18n';
import { cn } from '@/lib/cn';

interface Tab {
  to: string;
  labelKey: I18nKey;
  icon: LucideIcon;
  /** end=true → only active on exact match (for index routes). */
  end?: boolean;
  emphasize?: boolean;
}

const CUSTOMER_TABS: Tab[] = [
  { to: '/app', labelKey: 'nav.home', icon: Home, end: true },
  { to: '/app/khatas', labelKey: 'nav.khata', icon: BookOpen },
  { to: '/app/scan', labelKey: 'nav.scan', icon: ScanLine, emphasize: true },
  { to: '/app/notifications', labelKey: 'nav.activity', icon: Inbox },
  { to: '/app/profile', labelKey: 'nav.profile', icon: User },
];

const MERCHANT_TABS: Tab[] = [
  { to: '/merchant', labelKey: 'nav.home', icon: Home, end: true },
  { to: '/merchant/requests', labelKey: 'nav.requests', icon: Inbox },
  { to: '/merchant/customers', labelKey: 'nav.customers', icon: Users },
  { to: '/merchant/qr', labelKey: 'nav.qr', icon: QrCode },
  { to: '/merchant/profile', labelKey: 'nav.profile', icon: User },
];

const ADMIN_TABS: Tab[] = [
  { to: '/admin', labelKey: 'admin.overview', icon: LayoutDashboard, end: true },
  { to: '/admin/users', labelKey: 'admin.users', icon: Users },
  { to: '/admin/merchants', labelKey: 'admin.merchants', icon: ShieldCheck },
  { to: '/admin/audit', labelKey: 'admin.audit', icon: ScrollText },
];

export function BottomNav() {
  const role = useAuth((s) => s.user?.role);
  const { t } = useT();

  const tabs = role === 'MERCHANT' || role === 'STAFF' ? MERCHANT_TABS : role === 'ADMIN' ? ADMIN_TABS : CUSTOMER_TABS;

  return (
    <nav className="sticky bottom-0 z-30 border-t border-ink-100 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="flex items-stretch justify-around px-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          if (tab.emphasize) {
            return (
              <NavLink key={tab.to} to={tab.to} className="flex flex-1 flex-col items-center justify-center py-1.5">
                {({ isActive }) => (
                  <>
                    <span
                      className={cn(
                        'mb-0.5 flex h-11 w-11 items-center justify-center rounded-2xl shadow-soft transition',
                        isActive ? 'bg-accent-500 text-white' : 'bg-accent-500 text-white',
                      )}
                    >
                      <Icon className="h-6 w-6" />
                    </span>
                    <span className="text-[11px] font-semibold text-ink-500">{t(tab.labelKey)}</span>
                  </>
                )}
              </NavLink>
            );
          }
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5"
            >
              {({ isActive }) => (
                <>
                  <Icon className={cn('h-[22px] w-[22px] transition', isActive ? 'text-brand-600' : 'text-ink-400')} />
                  <span
                    className={cn(
                      'text-[11px] font-semibold transition',
                      isActive ? 'text-brand-700' : 'text-ink-400',
                    )}
                  >
                    {t(tab.labelKey)}
                  </span>
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
