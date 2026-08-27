import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Inbox, Package, X } from 'lucide-react';
import { useAcceptUdhaar, useRejectUdhaar, useUdhaarList } from '@/services/hooks';
import type { MerchantUdhaar } from '@/lib/types';
import { useUi } from '@/store/ui';
import { ApiError } from '@/lib/api';
import { TopBar } from '@/components/layout/TopBar';
import { PageBody } from '@/components/layout/PageBody';
import { Card } from '@/components/ui/Card';
import { Money } from '@/components/ui/Money';
import { Button } from '@/components/ui/Button';
import { BottomSheet } from '@/components/ui/Modal';
import { Field, Textarea } from '@/components/ui/Input';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { formatDate } from '@/lib/dates';
import { useT } from '@/i18n';

export function Requests() {
  const { t } = useT();
  const pushToast = useUi((s) => s.pushToast);
  const q = useUdhaarList<MerchantUdhaar[]>();
  const accept = useAcceptUdhaar();
  const reject = useRejectUdhaar();

  const [rejectTarget, setRejectTarget] = useState<MerchantUdhaar | null>(null);
  const [reason, setReason] = useState('');

  const requests = (q.data ?? []).filter((u) => u.status === 'REQUESTED');

  const onAccept = async (u: MerchantUdhaar) => {
    try {
      await accept.mutateAsync(u.id);
      pushToast({ kind: 'success', message: t('merchant.accepted') });
    } catch (e) {
      pushToast({ kind: 'error', message: e instanceof ApiError ? e.message : 'Could not accept' });
    }
  };

  const onReject = async () => {
    if (!rejectTarget) return;
    try {
      await reject.mutateAsync({ id: rejectTarget.id, reason: reason.trim() || undefined });
      pushToast({ kind: 'success', message: t('merchant.rejected') });
      setRejectTarget(null);
      setReason('');
    } catch (e) {
      pushToast({ kind: 'error', message: e instanceof ApiError ? e.message : 'Could not reject' });
    }
  };

  return (
    <>
      <TopBar title={t('merchant.pendingRequests')} subtitle={requests.length ? `${requests.length} waiting` : undefined} />
      <PageBody>
        {q.isLoading ? (
          <LoadingState />
        ) : q.isError ? (
          <ErrorState onRetry={() => q.refetch()} />
        ) : requests.length === 0 ? (
          <EmptyState icon={<Inbox className="h-7 w-7" />} title={t('merchant.noRequests')} />
        ) : (
          <div className="space-y-3">
            {requests.map((u) => (
              <Card key={u.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link to={`/merchant/udhaar/${u.id}`} className="font-semibold text-ink-900">
                      {u.customerName}
                    </Link>
                    {u.customerMobile && <p className="text-xs text-ink-400">{u.customerMobile}</p>}
                    <p className="mt-0.5 text-[11px] font-medium text-ink-300">{u.ref}</p>
                  </div>
                  <div className="text-right">
                    <Money paise={u.principalPaise} size="lg" tone="due" />
                    <p className="text-xs text-ink-400">by {formatDate(u.dueDate)}</p>
                  </div>
                </div>

                {u.items && u.items.length > 0 && (
                  <div className="mt-3 space-y-1 rounded-2xl bg-ink-50 p-3">
                    {u.items.map((it, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-ink-600">
                        <Package className="h-3.5 w-3.5 text-ink-400" />
                        <span className="flex-1 truncate">
                          {it.name}
                          {it.qty ? ` × ${it.qty}` : ''}
                        </span>
                        {typeof it.pricePaise === 'number' && <Money paise={it.pricePaise} size="sm" tone="muted" />}
                      </div>
                    ))}
                  </div>
                )}

                {u.note && <p className="mt-3 rounded-2xl bg-ink-50 p-3 text-sm text-ink-600">“{u.note}”</p>}

                {u.limitExceeded && (
                  <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
                    Above this customer's usual credit limit
                  </p>
                )}

                <div className="mt-4 grid grid-cols-2 gap-2.5">
                  <Button
                    variant="outline"
                    className="!text-rose-600"
                    onClick={() => {
                      setReason('');
                      setRejectTarget(u);
                    }}
                  >
                    <X className="h-5 w-5" /> {t('merchant.reject')}
                  </Button>
                  <Button
                    variant="primary"
                    loading={accept.isPending && accept.variables === u.id}
                    onClick={() => onAccept(u)}
                  >
                    <Check className="h-5 w-5" /> {t('merchant.accept')}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </PageBody>

      <BottomSheet
        open={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        title={t('merchant.reject')}
        footer={
          <Button variant="danger" fullWidth loading={reject.isPending} onClick={onReject}>
            {t('merchant.reject')}
          </Button>
        }
      >
        <p className="mb-3 text-sm text-ink-500">
          Rejecting {rejectTarget?.customerName}'s request for{' '}
          <span className="font-semibold text-ink-700">
            {rejectTarget ? `₹${(rejectTarget.principalPaise / 100).toLocaleString('en-IN')}` : ''}
          </span>
          .
        </p>
        <Field label={t('common.note')} hint={t('common.optional')}>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for the customer" />
        </Field>
      </BottomSheet>
    </>
  );
}
