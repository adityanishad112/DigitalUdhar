import { useMemo, useState } from 'react';
import { Search, Users } from 'lucide-react';
import { useMerchantCustomers } from '@/services/hooks';
import type { MerchantCustomerRow } from '@/lib/types';
import { TopBar } from '@/components/layout/TopBar';
import { PageBody } from '@/components/layout/PageBody';
import { Money } from '@/components/ui/Money';
import { Input } from '@/components/ui/Input';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { useT } from '@/i18n';

export function Customers() {
  const { t } = useT();
  const q = useMerchantCustomers();
  const [search, setSearch] = useState('');

  const rows = q.data ?? [];
  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    const list = s
      ? rows.filter((r) => (r.name ?? '').toLowerCase().includes(s) || (r.mobile ?? '').includes(s))
      : rows;
    // Highest outstanding first — figures come straight from the ledger.
    return [...list].sort((a, b) => b.outstandingPaise - a.outstandingPaise);
  }, [rows, search]);

  return (
    <>
      <TopBar title={t('nav.customers')} subtitle={rows.length ? t('merchant.customersCount', { n: rows.length }) : undefined} />
      <PageBody>
        {q.isLoading ? (
          <LoadingState />
        ) : q.isError ? (
          <ErrorState onRetry={() => q.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState icon={<Users className="h-7 w-7" />} title="No customers yet" description="Customers appear here after they take their first udhaar." />
        ) : (
          <>
            <Input
              leading={<Search className="h-4 w-4" />}
              placeholder="Search name or mobile"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="space-y-2">
              {filtered.map((c) => (
                <CustomerCard key={c.customerUserId} c={c} />
              ))}
            </div>
          </>
        )}
      </PageBody>
    </>
  );
}

function CustomerCard({ c }: { c: MerchantCustomerRow }) {
  const cleared = c.outstandingPaise === 0;
  const name = c.name ?? 'Customer';
  return (
    <div className="rounded-2xl bg-white px-4 py-3.5 shadow-soft">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 font-bold text-brand-600">
          {name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-ink-900">{name}</p>
          {c.mobile && <p className="text-xs text-ink-400">{c.mobile}</p>}
        </div>
        <div className="text-right">
          <Money paise={cleared ? 0 : c.outstandingPaise} tone={cleared ? 'paid' : 'due'} />
          <p className="text-[11px] text-ink-400">{cleared ? 'Settled' : 'Outstanding'}</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-ink-100 pt-3 text-center">
        <div>
          <p className="text-[11px] text-ink-400">Given</p>
          <Money paise={c.totalUdhaarPaise} size="sm" tone="muted" />
        </div>
        <div>
          <p className="text-[11px] text-ink-400">Repaid</p>
          <Money paise={c.totalRepaidPaise} size="sm" tone="muted" />
        </div>
        <div>
          <p className="text-[11px] text-ink-400">Limit</p>
          <Money paise={c.creditLimitPaise ?? 0} size="sm" tone="muted" />
        </div>
      </div>
    </div>
  );
}
