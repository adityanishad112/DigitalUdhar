import { Link } from 'react-router-dom';
import { FileText, Store, TriangleAlert, Users } from 'lucide-react';
import { useAdminOverview } from '@/services/hooks';
import { TopBar } from '@/components/layout/TopBar';
import { PageBody } from '@/components/layout/PageBody';
import { NotificationBell } from '@/components/layout/NotificationBell';
import { LogoutButton } from '@/components/layout/LogoutButton';
import { Card, CardHeader } from '@/components/ui/Card';
import { Money } from '@/components/ui/Money';
import { LoadingState, ErrorState } from '@/components/ui/states';
import { useT } from '@/i18n';

/** A labelled row of {key: count} breakdowns. */
function Breakdown({ title, data }: { title: string; data: Record<string, number> }) {
  const entries = Object.entries(data).filter(([, v]) => v > 0);
  return (
    <Card>
      <CardHeader title={title} />
      {entries.length === 0 ? (
        <p className="text-sm text-ink-400">None yet</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {entries.map(([k, v]) => (
            <span key={k} className="rounded-full bg-ink-50 px-3 py-1 text-sm">
              <span className="font-semibold text-ink-900">{v}</span>{' '}
              <span className="text-ink-500">{k.replace(/_/g, ' ').toLowerCase()}</span>
            </span>
          ))}
        </div>
      )}
    </Card>
  );
}

function Tile({ icon, label, value, to }: { icon: React.ReactNode; label: string; value: number; to: string }) {
  return (
    <Link to={to} className="rounded-2xl bg-white p-4 shadow-soft transition active:scale-[0.98]">
      <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">{icon}</div>
      <p className="mt-2 font-display text-2xl font-extrabold tnum text-ink-900">{value}</p>
      <p className="text-xs text-ink-500">{label}</p>
    </Link>
  );
}

export function AdminOverviewPage() {
  const { t } = useT();
  const q = useAdminOverview();
  const d = q.data;

  return (
    <>
      <TopBar
        title={t('admin.title')}
        subtitle={t('admin.overview')}
        right={
          <div className="flex items-center gap-1">
            <NotificationBell />
            <LogoutButton />
          </div>
        }
      />
      <PageBody>
        {q.isLoading ? (
          <LoadingState />
        ) : q.isError || !d ? (
          <ErrorState onRetry={() => q.refetch()} />
        ) : (
          <>
            {/* Platform money — every figure aggregated by the backend ledger. */}
            <div className="card overflow-hidden">
              <div className="bg-gradient-to-br from-ink-900 to-ink-700 px-5 py-5 text-white">
                <p className="text-sm text-white/70">Total outstanding across all shops</p>
                <Money paise={d.money.totalOutstandingPaise} size="2xl" className="mt-1 text-white" />
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-white/10 px-3 py-2">
                    <p className="text-xs text-white/70">Udhaar volume</p>
                    <Money paise={d.money.totalUdhaarVolumePaise} className="mt-0.5 text-white" />
                  </div>
                  <div className="rounded-2xl bg-white/10 px-3 py-2">
                    <p className="text-xs text-white/70">Collected</p>
                    <Money paise={d.money.totalCollectedPaise} className="mt-0.5 text-white" />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <Tile icon={<Users className="h-5 w-5" />} label={t('admin.users')} value={d.users.total} to="/admin/users" />
              <Tile icon={<Store className="h-5 w-5" />} label={t('admin.merchants')} value={d.merchants.total} to="/admin/merchants" />
              <Tile icon={<FileText className="h-5 w-5" />} label="Audit log" value={d.udhaar.total} to="/admin/audit" />
              <div className="rounded-2xl bg-white p-4 shadow-soft">
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-rose-50 text-rose-500">
                  <TriangleAlert className="h-5 w-5" />
                </div>
                <p className="mt-2 font-display text-2xl font-extrabold tnum text-ink-900">{d.openDisputes}</p>
                <p className="text-xs text-ink-500">Open disputes</p>
              </div>
            </div>

            <Breakdown title="Users by role" data={d.users.byRole} />
            <Breakdown title="Merchants by status" data={d.merchants.byStatus} />
            <Breakdown title="Udhaar by status" data={d.udhaar.byStatus} />
            <Breakdown title="Payments by status" data={d.payments.byStatus} />
          </>
        )}
      </PageBody>
    </>
  );
}
