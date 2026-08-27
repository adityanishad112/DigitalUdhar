import { useState } from 'react';
import { ShieldCheck, UserCog, Users as UsersIcon } from 'lucide-react';
import { useAdminUsers, useSetUserStatus } from '@/services/hooks';
import type { AdminUser } from '@/lib/types';
import { useUi } from '@/store/ui';
import { ApiError } from '@/lib/api';
import { TopBar } from '@/components/layout/TopBar';
import { PageBody } from '@/components/layout/PageBody';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { BottomSheet } from '@/components/ui/Modal';
import { Field, Input, Textarea } from '@/components/ui/Input';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import type { Tone } from '@/lib/status';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/dates';
import { useT } from '@/i18n';

const USER_STATUSES = ['ACTIVE', 'FROZEN', 'SUSPENDED'] as const;
const ROLE_FILTERS = ['ALL', 'CUSTOMER', 'MERCHANT', 'STAFF', 'ADMIN'] as const;

const statusTone: Record<string, Tone> = {
  ACTIVE: 'green',
  FROZEN: 'amber',
  SUSPENDED: 'red',
};
const roleTone: Record<string, Tone> = {
  CUSTOMER: 'blue',
  MERCHANT: 'green',
  STAFF: 'violet',
  ADMIN: 'gray',
};

export function AdminUsersPage() {
  const { t } = useT();
  const pushToast = useUi((s) => s.pushToast);
  const [role, setRole] = useState<(typeof ROLE_FILTERS)[number]>('ALL');
  const [search, setSearch] = useState('');

  const filters: Record<string, string> = {};
  if (role !== 'ALL') filters.role = role;
  if (search.trim()) filters.q = search.trim();

  const q = useAdminUsers(filters);
  const setStatus = useSetUserStatus();

  const [target, setTarget] = useState<AdminUser | null>(null);
  const [nextStatus, setNextStatus] = useState<(typeof USER_STATUSES)[number]>('ACTIVE');
  const [reason, setReason] = useState('');

  const rows = q.data ?? [];

  const openSheet = (u: AdminUser) => {
    setTarget(u);
    setNextStatus((u.status as (typeof USER_STATUSES)[number]) ?? 'ACTIVE');
    setReason('');
  };

  const apply = async () => {
    if (!target) return;
    try {
      await setStatus.mutateAsync({ id: target.id, status: nextStatus, reason: reason.trim() || undefined });
      pushToast({ kind: 'success', message: `${target.name ?? 'User'} → ${nextStatus.toLowerCase()}` });
      setTarget(null);
    } catch (e) {
      pushToast({ kind: 'error', message: e instanceof ApiError ? e.message : 'Could not update user' });
    }
  };

  return (
    <>
      <TopBar title={t('admin.users')} subtitle={rows.length ? `${rows.length} users` : undefined} />
      <PageBody>
        <Input placeholder="Search name or mobile" value={search} onChange={(e) => setSearch(e.target.value)} />

        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {ROLE_FILTERS.map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className={cn(
                'shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition',
                role === r ? 'bg-brand-500 text-white shadow-soft' : 'bg-white text-ink-600 shadow-soft',
              )}
            >
              {r === 'ALL' ? 'All' : r.charAt(0) + r.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {q.isLoading ? (
          <LoadingState />
        ) : q.isError ? (
          <ErrorState onRetry={() => q.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState icon={<UsersIcon className="h-7 w-7" />} title="No users found" />
        ) : (
          <div className="space-y-2">
            {rows.map((u) => (
              <button
                key={u.id}
                onClick={() => openSheet(u)}
                className="flex w-full items-center gap-3 rounded-2xl bg-white px-4 py-3 text-left shadow-soft transition active:scale-[0.99]"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ink-50 font-bold text-ink-500">
                  {(u.name ?? u.mobile).charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink-900">{u.name ?? 'Unnamed'}</p>
                  <p className="text-xs text-ink-400">
                    {u.mobile} · joined {formatDate(u.createdAt)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge tone={roleTone[u.role] ?? 'gray'}>{u.role.toLowerCase()}</Badge>
                  <Badge tone={statusTone[u.status] ?? 'gray'} dot>
                    {u.status.toLowerCase()}
                  </Badge>
                </div>
              </button>
            ))}
          </div>
        )}
      </PageBody>

      <BottomSheet
        open={!!target}
        onClose={() => setTarget(null)}
        title="Manage user"
        footer={
          <Button
            fullWidth
            loading={setStatus.isPending}
            disabled={nextStatus === target?.status}
            onClick={apply}
          >
            Update status
          </Button>
        }
      >
        {target && (
          <>
            <div className="mb-4 flex items-center gap-3 rounded-2xl bg-ink-50 p-3">
              <UserCog className="h-5 w-5 text-ink-400" />
              <div>
                <p className="font-semibold text-ink-900">{target.name ?? 'Unnamed'}</p>
                <p className="text-xs text-ink-400">
                  {target.mobile} · {target.role.toLowerCase()}
                </p>
              </div>
            </div>

            <Field label="Account status">
              <div className="grid grid-cols-3 gap-2">
                {USER_STATUSES.map((s) => (
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

            {nextStatus !== 'ACTIVE' && (
              <Field label="Reason" hint="Recorded in the audit log">
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this account being restricted?" />
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
