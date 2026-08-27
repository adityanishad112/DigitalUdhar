import { useMemo, useState } from 'react';
import { FileClock, Search } from 'lucide-react';
import { useAuditLogs } from '@/services/hooks';
import { TopBar } from '@/components/layout/TopBar';
import { PageBody } from '@/components/layout/PageBody';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import type { Tone } from '@/lib/status';
import { formatDateTime } from '@/lib/dates';
import { useT } from '@/i18n';

const roleTone: Record<string, Tone> = {
  CUSTOMER: 'blue',
  MERCHANT: 'green',
  STAFF: 'violet',
  ADMIN: 'gray',
  SYSTEM: 'gray',
};

function actionLabel(action: string): string {
  return action.replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function AdminAuditPage() {
  const { t } = useT();
  const q = useAuditLogs();
  const [search, setSearch] = useState('');

  const rows = q.data ?? [];
  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(
      (l) =>
        l.action.toLowerCase().includes(s) ||
        (l.summary ?? '').toLowerCase().includes(s) ||
        (l.entityType ?? '').toLowerCase().includes(s),
    );
  }, [rows, search]);

  return (
    <>
      <TopBar title={t('admin.audit')} subtitle="Immutable record of every sensitive action" />
      <PageBody>
        {q.isLoading ? (
          <LoadingState />
        ) : q.isError ? (
          <ErrorState onRetry={() => q.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState icon={<FileClock className="h-7 w-7" />} title="No audit entries yet" />
        ) : (
          <>
            <Input
              leading={<Search className="h-4 w-4" />}
              placeholder="Search action, entity, summary"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="space-y-2">
              {filtered.map((l) => (
                <div key={l.id} className="rounded-2xl bg-white px-4 py-3 shadow-soft">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-ink-900">{actionLabel(l.action)}</p>
                      {l.summary && <p className="mt-0.5 text-sm text-ink-500">{l.summary}</p>}
                    </div>
                    {l.actorRole && <Badge tone={roleTone[l.actorRole] ?? 'gray'}>{l.actorRole.toLowerCase()}</Badge>}
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-[11px] text-ink-400">
                    {l.entityType && (
                      <span className="rounded-full bg-ink-50 px-2 py-0.5 font-medium text-ink-500">
                        {l.entityType.toLowerCase()}
                      </span>
                    )}
                    <span>{formatDateTime(l.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </PageBody>
    </>
  );
}
