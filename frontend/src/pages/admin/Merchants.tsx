import { useState } from 'react';
import { ShieldCheck, Store } from 'lucide-react';
import { useAdminMerchants, useSetMerchantStatus } from '@/services/hooks';
import type { AdminMerchant } from '@/lib/types';
import { useUi } from '@/store/ui';
import { ApiError } from '@/lib/api';
import { TopBar } from '@/components/layout/TopBar';
import { PageBody } from '@/components/layout/PageBody';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { BottomSheet } from '@/components/ui/Modal';
import { Field, Textarea } from '@/components/ui/Input';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import type { Tone } from '@/lib/status';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/dates';
import { useT } from '@/i18n';

const MERCHANT_STATUSES = ['PENDING', 'ACTIVE', 'SUSPENDED'] as const;
const STATUS_FILTERS = ['ALL', ...MERCHANT_STATUSES] as const;

const statusTone: Record<string, Tone> = {
  ACTIVE: 'green',
  PENDING: 'amber',
  SUSPENDED: 'red',
};

export function AdminMerchantsPage() {
  const { t } = useT();
  const pushToast = useUi((s) => s.pushToast);
  const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number]>('ALL');

  const filters: Record<string, string> = {};
  if (status !== 'ALL') filters.status = status;

  const q = useAdminMerchants(filters);
  const setMerchantStatus = useSetMerchantStatus();

  const [target, setTarget] = useState<AdminMerchant | null>(null);
  const [nextStatus, setNextStatus] = useState<(typeof MERCHANT_STATUSES)[number]>('ACTIVE');
  const [reason, setReason] = useState('');

  const rows = q.data ?? [];

  const openSheet = (m: AdminMerchant) => {
    setTarget(m);
    setNextStatus((m.status as (typeof MERCHANT_STATUSES)[number]) ?? 'ACTIVE');
    setReason('');
  };

  const apply = async () => {
    if (!target) return;
    try {
      await setMerchantStatus.mutateAsync({ id: target.id, status: nextStatus, reason: reason.trim() || undefined });
      pushToast({ kind: 'success', message: `${target.shopName} → ${nextStatus.toLowerCase()}` });
      setTarget(null);
    } catch (e) {
      pushToast({ kind: 'error', message: e instanceof ApiError ? e.message : 'Could not update shop' });
    }
  };

  return (
    <>
      <TopBar title={t('admin.merchants')} subtitle={rows.length ? `${rows.length} shops` : undefined} />
      <PageBody>
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={cn(
                'shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition',
                status === s ? 'bg-brand-500 text-white shadow-soft' : 'bg-white text-ink-600 shadow-soft',
              )}
            >
              {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {q.isLoading ? (
          <LoadingState />
        ) : q.isError ? (
          <ErrorState onRetry={() => q.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState icon={<Store className="h-7 w-7" />} title="No shops found" />
        ) : (
          <div className="space-y-2">
            {rows.map((m) => (
              <button
                key={m.id}
                onClick={() => openSheet(m)}
                className="flex w-full items-center gap-3 rounded-2xl bg-white px-4 py-3 text-left shadow-soft transition active:scale-[0.99]"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                  <Store className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink-900">{m.shopName}</p>
                  <p className="text-xs text-ink-400">
                    {m.city ?? '—'} · since {formatDate(m.createdAt)}
                  </p>
                </div>
                <Badge tone={statusTone[m.status] ?? 'gray'} dot>
                  {m.status.toLowerCase()}
                </Badge>
              </button>
            ))}
          </div>
        )}
      </PageBody>

      <BottomSheet
        open={!!target}
        onClose={() => setTarget(null)}
        title="Manage shop"
        footer={
          <Button fullWidth loading={setMerchantStatus.isPending} disabled={nextStatus === target?.status} onClick={apply}>
            Update status
          </Button>
        }
      >
        {target && (
          <>
            <div className="mb-4 flex items-center gap-3 rounded-2xl bg-ink-50 p-3">
              <Store className="h-5 w-5 text-ink-400" />
              <div>
                <p className="font-semibold text-ink-900">{target.shopName}</p>
                <p className="text-xs text-ink-400">{target.city ?? '—'}</p>
              </div>
            </div>

            <Field label="Shop status">
              <div className="grid grid-cols-3 gap-2">
                {MERCHANT_STATUSES.map((s) => (
                  <button
                    key={s}
                    onClick={() => setNextStatus(s)}
                    className={cn(
                      'rounded-2xl border px-2 py-2.5 text-sm font-semibold transition',
                      nextStatus === s ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-ink-200 text-ink-600',
                    )}
                  >
                    {s.charAt(0) + s.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </Field>

            {nextStatus === 'SUSPENDED' && (
              <Field label="Reason" hint="Recorded in the audit log">
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this shop being suspended?" />
              </Field>
            )}

            <p className="flex items-center gap-1.5 text-xs text-ink-400">
              <ShieldCheck className="h-3.5 w-3.5" /> Every status change is written to the immutable audit log.
            </p>
          </>
        )}
      </BottomSheet>
    </>
  );
}
