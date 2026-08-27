import { Link } from 'react-router-dom';
import { QrCode, Wallet } from 'lucide-react';
import { useUdhaarList } from '@/services/hooks';
import type { CustomerUdhaar } from '@/lib/types';
import { useAuth } from '@/store/auth';
import { TopBar } from '@/components/layout/TopBar';
import { PageBody } from '@/components/layout/PageBody';
import { NotificationBell } from '@/components/layout/NotificationBell';
import { Money } from '@/components/ui/Money';
import { Button } from '@/components/ui/Button';
import { UdhaarRow } from '@/components/udhaar/UdhaarRow';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { useT } from '@/i18n';

export function CustomerHome() {
  const { t } = useT();
  const name = useAuth((s) => s.user?.name);
  const q = useUdhaarList<CustomerUdhaar[]>();

  const rows = q.data ?? [];
  const open = rows.filter((r) => r.status === 'ACTIVE' || r.status === 'REQUESTED' || r.status === 'DISPUTED');
  const overdueCount = rows.filter((r) => r.bucket === 'OVERDUE' || r.bucket === 'PROMISE_MISSED').length;
  // Headline = sum of server-authoritative per-khata balances. Each value is
  // computed and owned by the backend; the client only aggregates for display.
  const totalOutstanding = rows.reduce((sum, r) => sum + (r.status === 'CLEARED' ? 0 : r.outstandingPaise), 0);

  return (
    <>
      <TopBar
        title={`${t('app.name')}`}
        subtitle={name ? `Namaste, ${name.split(' ')[0]} 👋` : undefined}
        right={<NotificationBell />}
      />
      <PageBody>
        {/* Outstanding hero */}
        <div className="card overflow-hidden">
          <div className="bg-gradient-to-br from-brand-600 to-brand-500 px-5 py-5 text-white">
            <p className="text-sm text-white/80">{t('common.you_owe')}</p>
            <Money paise={totalOutstanding} size="2xl" className="mt-1 text-white" />
            <div className="mt-3 flex gap-4 text-sm">
              <span className="text-white/85">
                {open.length} active {open.length === 1 ? 'khata' : 'khatas'}
              </span>
              {overdueCount > 0 && (
                <span className="rounded-full bg-white/15 px-2 py-0.5 font-semibold">{overdueCount} overdue</span>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 p-3">
            <Link to="/app/scan">
              <Button variant="primary" fullWidth>
                <QrCode className="h-5 w-5" /> {t('nav.scan')}
              </Button>
            </Link>
            <Link to="/app/khatas">
              <Button variant="ghost" fullWidth>
                <Wallet className="h-5 w-5" /> {t('nav.khata')}
              </Button>
            </Link>
          </div>
        </div>

        {/* Khatas */}
        <div className="flex items-center justify-between px-1">
          <h2 className="font-display text-base font-bold text-ink-900">{t('nav.khata')}</h2>
          {rows.length > 0 && (
            <Link to="/app/khatas" className="text-sm font-semibold text-brand-600">
              {t('common.viewAll')}
            </Link>
          )}
        </div>

        {q.isLoading ? (
          <LoadingState />
        ) : q.isError ? (
          <ErrorState onRetry={() => q.refetch()} />
        ) : open.length === 0 ? (
          <EmptyState
            icon={<Wallet className="h-7 w-7" />}
            title="No active khatas"
            description={t('empty.khatas')}
            action={
              <Link to="/app/scan">
                <Button size="sm">
                  <QrCode className="h-4 w-4" /> {t('scan.title')}
                </Button>
              </Link>
            }
          />
        ) : (
          <div className="space-y-2">
            {open.slice(0, 5).map((u) => (
              <UdhaarRow
                key={u.id}
                to={`/app/udhaar/${u.id}`}
                title={u.shopName}
                subtitle={u.merchantCity}
                outstandingPaise={u.outstandingPaise}
                principalPaise={u.principalPaise}
                bucket={u.bucket}
                status={u.status}
                dueDate={u.dueDate}
                refNo={u.ref}
              />
            ))}
          </div>
        )}
      </PageBody>
    </>
  );
}
