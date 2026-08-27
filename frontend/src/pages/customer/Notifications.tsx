import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { useMarkAllRead, useMarkNotificationRead, useNotifications } from '@/services/hooks';
import type { Notification } from '@/lib/types';
import { useAuth } from '@/store/auth';
import { TopBar } from '@/components/layout/TopBar';
import { PageBody } from '@/components/layout/PageBody';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { fromNow } from '@/lib/dates';
import { cn } from '@/lib/cn';
import { useT } from '@/i18n';

export function Notifications() {
  const { t } = useT();
  const navigate = useNavigate();
  const role = useAuth((s) => s.user?.role);
  const q = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllRead();

  const items = q.data ?? [];
  const hasUnread = items.some((n) => !n.read);

  const udhaarBase = role === 'MERCHANT' || role === 'STAFF' ? '/merchant/udhaar' : '/app/udhaar';
  const open = (n: Notification) => {
    if (!n.read) markRead.mutate(n.id);
    const udhaarId = (n.data as { udhaarId?: string } | null)?.udhaarId;
    if (udhaarId) navigate(`${udhaarBase}/${udhaarId}`);
  };

  return (
    <>
      <TopBar
        title={t('nav.activity')}
        right={
          hasUnread ? (
            <button
              onClick={() => markAll.mutate()}
              className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold"
            >
              <CheckCheck className="h-4 w-4" /> Read all
            </button>
          ) : undefined
        }
      />
      <PageBody>
        {q.isLoading ? (
          <LoadingState />
        ) : q.isError ? (
          <ErrorState onRetry={() => q.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState icon={<Bell className="h-7 w-7" />} title={t('empty.notifications')} />
        ) : (
          <div className="space-y-2">
            {items.map((n) => (
              <button
                key={n.id}
                onClick={() => open(n)}
                className={cn(
                  'flex w-full items-start gap-3 rounded-2xl px-4 py-3.5 text-left shadow-soft transition active:scale-[0.99]',
                  n.read ? 'bg-white' : 'bg-brand-50/60 ring-1 ring-brand-100',
                )}
              >
                <span
                  className={cn(
                    'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                    n.read ? 'bg-transparent' : 'bg-brand-500',
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink-900">{n.title}</p>
                  {n.body && <p className="mt-0.5 text-sm text-ink-500">{n.body}</p>}
                  <p className="mt-1 text-[11px] text-ink-400">{fromNow(n.createdAt)}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </PageBody>
    </>
  );
}
