import { useState } from 'react';
import { Wallet } from 'lucide-react';
import { useUdhaarList } from '@/services/hooks';
import type { CustomerUdhaar } from '@/lib/types';
import { TopBar } from '@/components/layout/TopBar';
import { PageBody } from '@/components/layout/PageBody';
import { UdhaarRow } from '@/components/udhaar/UdhaarRow';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { cn } from '@/lib/cn';
import { useT } from '@/i18n';

type Filter = 'ALL' | 'ACTIVE' | 'CLEARED';
const FILTERS: Filter[] = ['ALL', 'ACTIVE', 'CLEARED'];

export function Khatas() {
  const { t } = useT();
  const [filter, setFilter] = useState<Filter>('ALL');
  const q = useUdhaarList<CustomerUdhaar[]>();

  const rows = (q.data ?? []).filter((r) => {
    if (filter === 'ACTIVE') return r.status === 'ACTIVE' || r.status === 'REQUESTED' || r.status === 'DISPUTED';
    if (filter === 'CLEARED') return r.status === 'CLEARED';
    return true;
  });

  return (
    <>
      <TopBar title={t('nav.khata')} subtitle="Your udhaar across shops" />
      <PageBody>
        <div className="flex gap-2">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'rounded-full px-4 py-1.5 text-sm font-semibold transition',
                filter === f ? 'bg-brand-500 text-white shadow-soft' : 'bg-white text-ink-500',
              )}
            >
              {f === 'ALL' ? 'All' : f === 'ACTIVE' ? t('udhaar.status.active') : t('common.cleared')}
            </button>
          ))}
        </div>

        {q.isLoading ? (
          <LoadingState />
        ) : q.isError ? (
          <ErrorState onRetry={() => q.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState icon={<Wallet className="h-7 w-7" />} title="Nothing here" description={t('empty.khatas')} />
        ) : (
          <div className="space-y-2">
            {rows.map((u) => (
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
