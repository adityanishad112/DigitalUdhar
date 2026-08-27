import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  ChevronRight,
  QrCode,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { useMerchantReport, useMyShop } from '@/services/hooks';
import type { Merchant, MerchantReport } from '@/lib/types';
import { useAuth } from '@/store/auth';
import { ApiError } from '@/lib/api';
import { TopBar } from '@/components/layout/TopBar';
import { PageBody } from '@/components/layout/PageBody';
import { NotificationBell } from '@/components/layout/NotificationBell';
import { LogoutButton } from '@/components/layout/LogoutButton';
import { Card } from '@/components/ui/Card';
import { Money } from '@/components/ui/Money';
import { Button } from '@/components/ui/Button';
import { LoadingState, ErrorState } from '@/components/ui/states';
import { RegisterShop } from './RegisterShop';
import { useT } from '@/i18n';

export function MerchantHome() {
  const role = useAuth((s) => s.user?.role);
  const shopQ = useMyShop();

  if (shopQ.isLoading) {
    return (
      <>
        <TopBar title="Shop dashboard" right={<LogoutButton />} />
        <LoadingState />
      </>
    );
  }

  if (shopQ.isError) {
    const notFound = shopQ.error instanceof ApiError && shopQ.error.status === 404;
    // A merchant with no shop yet gets the onboarding form; staff must be linked
    // to a shop by the owner, so they only see an error until that happens.
    if (notFound && role === 'MERCHANT') return <RegisterShop />;
    return (
      <>
        <TopBar title="Shop dashboard" right={<LogoutButton />} />
        <ErrorState
          title={notFound ? 'No shop linked to your account yet' : undefined}
          onRetry={() => shopQ.refetch()}
        />
      </>
    );
  }

  return <MerchantDashboard shop={shopQ.data!} />;
}

/** Small labelled metric tile. */
function Stat({
  label,
  value,
  tone = 'ink',
}: {
  label: string;
  value: number | string;
  tone?: 'ink' | 'amber' | 'rose' | 'emerald';
}) {
  const toneText =
    tone === 'amber'
      ? 'text-amber-600'
      : tone === 'rose'
        ? 'text-rose-600'
        : tone === 'emerald'
          ? 'text-emerald-600'
          : 'text-ink-900';
  return (
    <div className="rounded-2xl bg-white p-3.5 shadow-soft">
      <p className="text-xs font-medium text-ink-500">{label}</p>
      <p className={`mt-1 font-display text-2xl font-extrabold tnum ${toneText}`}>{value}</p>
    </div>
  );
}

function MerchantDashboard({ shop }: { shop: Merchant }) {
  const { t } = useT();
  const reportQ = useMerchantReport();
  const report = reportQ.data;

  return (
    <>
      <TopBar
        title={shop.shopName}
        subtitle={t('merchant.dashboard')}
        right={
          <div className="flex items-center gap-1">
            <NotificationBell />
            <LogoutButton />
          </div>
        }
      />
      <PageBody>
        {reportQ.isLoading ? (
          <LoadingState />
        ) : reportQ.isError ? (
          <ErrorState onRetry={() => reportQ.refetch()} />
        ) : report ? (
          <Dashboard report={report} />
        ) : null}
      </PageBody>
    </>
  );
}

function Dashboard({ report }: { report: MerchantReport }) {
  const { t } = useT();
  const pending = report.counts.requested;

  return (
    <div className="space-y-4">
      {/* Outstanding hero — every figure is computed by the backend ledger. */}
      <div className="card overflow-hidden">
        <div className="bg-gradient-to-br from-brand-600 to-brand-500 px-5 py-5 text-white">
          <p className="text-sm text-white/80">{t('merchant.outstanding')}</p>
          <Money paise={report.totalOutstandingPaise} size="2xl" className="mt-1 text-white" />
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white/12 px-3 py-2">
              <p className="flex items-center gap-1 text-xs text-white/75">
                <TrendingUp className="h-3.5 w-3.5" /> {t('merchant.collectedMonth')}
              </p>
              <Money paise={report.collectionsThisMonthPaise} className="mt-0.5 text-white" />
            </div>
            <div className="rounded-2xl bg-white/12 px-3 py-2">
              <p className="flex items-center gap-1 text-xs text-white/75">
                <AlertTriangle className="h-3.5 w-3.5" /> {t('merchant.overdue')}
              </p>
              <Money paise={report.overdueAmountPaise} className="mt-0.5 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Pending requests call-to-action */}
      {pending > 0 && (
        <Link to="/merchant/requests">
          <div className="flex items-center gap-3 rounded-3xl bg-accent-50 px-4 py-3.5 shadow-soft ring-1 ring-accent-100 transition active:scale-[0.99]">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent-500 font-bold text-white">
              {pending}
            </span>
            <div className="flex-1">
              <p className="font-semibold text-ink-900">{t('merchant.pendingRequests')}</p>
              <p className="text-sm text-ink-500">Tap to review and accept</p>
            </div>
            <ArrowRight className="h-5 w-5 text-accent-600" />
          </div>
        </Link>
      )}

      {/* Metric grid */}
      <div className="grid grid-cols-2 gap-2.5">
        <Stat label="Active khatas" value={report.counts.active} />
        <Stat label="Customers" value={report.customerCount} />
        <Stat label="Due today" value={report.counts.dueToday} tone={report.counts.dueToday ? 'amber' : 'ink'} />
        <Stat label={t('merchant.overdue')} value={report.counts.overdue} tone={report.counts.overdue ? 'rose' : 'ink'} />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-2.5">
        <Link to="/merchant/qr">
          <Button variant="primary" fullWidth>
            <QrCode className="h-5 w-5" /> {t('nav.qr')}
          </Button>
        </Link>
        <Link to="/merchant/customers">
          <Button variant="ghost" fullWidth>
            <Users className="h-5 w-5" /> {t('nav.customers')}
          </Button>
        </Link>
      </div>

      {/* Top debtors */}
      {report.topDebtors.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between px-1">
            <h2 className="font-display text-base font-bold text-ink-900">Top balances</h2>
            <Link to="/merchant/customers" className="text-sm font-semibold text-brand-600">
              {t('common.viewAll')}
            </Link>
          </div>
          <div className="space-y-2">
            {report.topDebtors.map((d) => (
              <Link
                key={d.customerUserId}
                to="/merchant/customers"
                className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-soft transition active:scale-[0.99]"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 font-bold text-brand-600">
                  {d.name.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink-900">{d.name}</p>
                  {d.mobile && <p className="text-xs text-ink-400">{d.mobile}</p>}
                </div>
                <Money paise={d.outstandingPaise} tone="due" />
                <ChevronRight className="h-5 w-5 shrink-0 text-ink-300" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {report.counts.total === 0 && (
        <Card className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-ink-50 text-ink-400">
            <Wallet className="h-7 w-7" />
          </div>
          <p className="font-semibold text-ink-900">No khatas yet</p>
          <p className="mt-1 text-sm text-ink-500">
            Share your counter QR so customers can take their first udhaar.
          </p>
          <Link to="/merchant/qr" className="mt-4 inline-block">
            <Button size="sm">
              <QrCode className="h-4 w-4" /> {t('nav.qr')}
            </Button>
          </Link>
        </Card>
      )}
    </div>
  );
}
