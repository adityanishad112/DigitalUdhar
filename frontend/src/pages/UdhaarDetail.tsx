import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  BadgeIndianRupee,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  HandCoins,
  PartyPopper,
  ReceiptText,
  ShieldAlert,
  SlidersHorizontal,
  Undo2,
} from 'lucide-react';
import {
  useAcceptUdhaar,
  useCashRepayment,
  useCreateAdjustment,
  usePromiseToPay,
  useRaiseDispute,
  useRefund,
  useRejectUdhaar,
  useUdhaarDetail,
} from '@/services/hooks';
import { useAuth } from '@/store/auth';
import { useUi } from '@/store/ui';
import { ApiError } from '@/lib/api';
import type { UdhaarEvent } from '@/lib/types';
import { rupeesToPaise } from '@/lib/money';
import { formatDate, formatDateTime, dueLabel } from '@/lib/dates';
import { eventMeta, udhaarStatus } from '@/lib/status';
import { TopBar } from '@/components/layout/TopBar';
import { PageBody } from '@/components/layout/PageBody';
import { Card } from '@/components/ui/Card';
import { Money } from '@/components/ui/Money';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Field, Input, Textarea } from '@/components/ui/Input';
import { BottomSheet } from '@/components/ui/Modal';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { cn } from '@/lib/cn';
import { useT } from '@/i18n';

const DISPUTE_CATEGORIES = [
  'WRONG_AMOUNT',
  'UNAUTHORIZED_UDHAAR',
  'DUPLICATE_TRANSACTION',
  'PAYMENT_MISSING',
  'WRONG_MERCHANT',
  'INCORRECT_REPAYMENT',
  'INCORRECT_DUE_DATE',
  'OTHER',
] as const;

const dotTone: Record<string, string> = {
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  red: 'bg-rose-500',
  blue: 'bg-sky-500',
  violet: 'bg-violet-500',
  gray: 'bg-ink-300',
};

type Sheet = null | 'promise' | 'dispute' | 'cash' | 'adjust' | 'refund';

export function UdhaarDetail() {
  const { t } = useT();
  const { id } = useParams();
  const navigate = useNavigate();
  const role = useAuth((s) => s.user?.role);
  const isMerchant = role === 'MERCHANT' || role === 'STAFF';
  const pushToast = useUi((s) => s.pushToast);

  const q = useUdhaarDetail(id ?? null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [refundTarget, setRefundTarget] = useState<{ paymentId: string; amountPaise: number } | null>(null);

  // Mutations
  const accept = useAcceptUdhaar();
  const reject = useRejectUdhaar();
  const promise = usePromiseToPay();
  const dispute = useRaiseDispute();
  const cash = useCashRepayment();
  const adjust = useCreateAdjustment();
  const refund = useRefund();

  // Sheet form state
  const [promiseDate, setPromiseDate] = useState('');
  const [promiseNote, setPromiseNote] = useState('');
  const [disputeCat, setDisputeCat] = useState<(typeof DISPUTE_CATEGORIES)[number]>('WRONG_AMOUNT');
  const [disputeDesc, setDisputeDesc] = useState('');
  const [cashAmount, setCashAmount] = useState('');
  const [adjAmount, setAdjAmount] = useState('');
  const [adjReason, setAdjReason] = useState('');
  const [adjDir, setAdjDir] = useState<'increase' | 'decrease'>('decrease');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');

  const u = q.data?.udhaar;
  const events = q.data?.events ?? [];
  // This screen is about ONE udhaar — show its own outstanding, not the
  // shop-level account balance (which sums every udhaar the customer has here).
  const outstanding = u?.outstandingPaise ?? 0;

  const counterpartyName = isMerchant ? q.data?.customer?.name ?? 'Customer' : q.data?.merchant?.shopName ?? 'Shop';
  const cleared = u?.status === 'CLEARED';

  const closeSheet = () => setSheet(null);
  const err = (e: unknown, fallback: string) =>
    pushToast({ kind: 'error', message: e instanceof ApiError ? e.message : fallback });

  const doAccept = async () => {
    if (!id) return;
    try {
      await accept.mutateAsync(id);
      pushToast({ kind: 'success', message: t('merchant.accepted') });
    } catch (e) {
      err(e, 'Could not accept');
    }
  };
  const doReject = async () => {
    if (!id) return;
    try {
      await reject.mutateAsync({ id });
      pushToast({ kind: 'success', message: t('merchant.rejected') });
    } catch (e) {
      err(e, 'Could not reject');
    }
  };
  const doPromise = async () => {
    if (!id || !promiseDate) return;
    try {
      await promise.mutateAsync({ id, promisedDate: promiseDate, note: promiseNote.trim() || undefined });
      pushToast({ kind: 'success', message: 'Promise to pay recorded' });
      closeSheet();
      setPromiseNote('');
    } catch (e) {
      err(e, 'Could not save promise');
    }
  };
  const doDispute = async () => {
    if (!id) return;
    try {
      await dispute.mutateAsync({ udhaarId: id, category: disputeCat, description: disputeDesc.trim() || undefined });
      pushToast({ kind: 'success', message: 'Dispute raised' });
      closeSheet();
      setDisputeDesc('');
    } catch (e) {
      err(e, 'Could not raise dispute');
    }
  };
  const doCash = async () => {
    const paise = rupeesToPaise(cashAmount);
    if (!id || paise <= 0) return;
    try {
      await cash.mutateAsync({ id, amountPaise: paise });
      pushToast({ kind: 'success', message: 'Cash payment recorded' });
      closeSheet();
      setCashAmount('');
    } catch (e) {
      err(e, 'Could not record cash');
    }
  };
  const doAdjust = async () => {
    const mag = rupeesToPaise(adjAmount);
    if (!id || mag <= 0 || !adjReason.trim()) return;
    const signed = adjDir === 'decrease' ? -mag : mag;
    try {
      await adjust.mutateAsync({ udhaarId: id, amountPaise: signed, reason: adjReason.trim() });
      pushToast({ kind: 'success', message: 'Adjustment posted' });
      closeSheet();
      setAdjAmount('');
      setAdjReason('');
    } catch (e) {
      err(e, 'Could not post adjustment');
    }
  };
  const doRefund = async () => {
    const paise = rupeesToPaise(refundAmount);
    if (!refundTarget || paise <= 0) return;
    try {
      await refund.mutateAsync({ paymentId: refundTarget.paymentId, amountPaise: paise, reason: refundReason.trim() || undefined });
      pushToast({ kind: 'success', message: 'Refund processed' });
      closeSheet();
      setRefundReason('');
    } catch (e) {
      err(e, 'Could not refund');
    }
  };

  if (q.isLoading) {
    return (
      <>
        <TopBar title="Udhaar" back />
        <LoadingState />
      </>
    );
  }
  if (q.isError || !u) {
    return (
      <>
        <TopBar title="Udhaar" back />
        <ErrorState onRetry={() => q.refetch()} />
      </>
    );
  }

  const due = dueLabel(u.dueDate);

  return (
    <>
      <TopBar title={counterpartyName} subtitle={u.ref} back />
      <PageBody>
        {/* Balance summary */}
        <Card>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-sm text-ink-500">{t('common.outstanding')}</p>
              <Money paise={cleared ? 0 : outstanding} size="2xl" tone={cleared ? 'paid' : 'due'} />
            </div>
            <StatusBadge meta={udhaarStatus(u.status)} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-ink-100 pt-4 text-sm">
            <div>
              <p className="text-ink-400">{t('udhaar.detail.principal')}</p>
              <Money paise={u.principalPaise} size="md" />
            </div>
            <div>
              <p className="text-ink-400">{t('udhaar.request.due')}</p>
              <p className="font-semibold text-ink-800">{formatDate(u.dueDate)}</p>
              {u.status === 'ACTIVE' && (
                <p className={cn('text-xs font-medium', due.tone === 'red' ? 'text-rose-600' : 'text-ink-400')}>
                  {due.text}
                </p>
              )}
            </div>
          </div>

          {/* Items */}
          {u.items && u.items.length > 0 && (
            <div className="mt-4 border-t border-ink-100 pt-3">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">Items</p>
              <ul className="space-y-1 text-sm text-ink-600">
                {u.items.map((it, i) => (
                  <li key={i} className="flex justify-between">
                    <span>
                      {it.name}
                      {it.qty ? ` × ${it.qty}` : ''}
                    </span>
                    {typeof it.pricePaise === 'number' && <Money paise={it.pricePaise} size="sm" strong={false} />}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {u.note && <p className="mt-3 rounded-2xl bg-ink-50 p-3 text-sm text-ink-600">“{u.note}”</p>}
        </Card>

        {/* Cleared celebration */}
        {cleared && (
          <div className="flex items-center gap-3 rounded-3xl bg-emerald-50 p-4 text-emerald-700 ring-1 ring-emerald-100">
            <PartyPopper className="h-6 w-6" />
            <div>
              <p className="font-display font-bold">{t('common.cleared')} — ₹0</p>
              <p className="text-sm text-emerald-600/80">
                {u.clearedAt ? `Cleared on ${formatDate(u.clearedAt)}` : 'Fully repaid'}
              </p>
            </div>
          </div>
        )}

        {/* Actions */}
        {!cleared && (
          <div className="space-y-2">
            {/* Merchant: accept/reject a request */}
            {isMerchant && u.status === 'REQUESTED' && (
              <div className="grid grid-cols-2 gap-2">
                <Button variant="primary" loading={accept.isPending} onClick={doAccept}>
                  <CheckCircle2 className="h-5 w-5" /> {t('merchant.accept')}
                </Button>
                <Button variant="outline" className="!text-rose-600" loading={reject.isPending} onClick={doReject}>
                  {t('merchant.reject')}
                </Button>
              </div>
            )}

            {/* Customer: pay / promise / dispute */}
            {!isMerchant && u.status === 'ACTIVE' && (
              <>
                <Link to={`/app/udhaar/${u.id}/pay`}>
                  <Button variant="accent" size="lg" fullWidth>
                    <BadgeIndianRupee className="h-5 w-5" /> {t('udhaar.detail.pay')}
                  </Button>
                </Link>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="ghost" onClick={() => setSheet('promise')}>
                    <CalendarClock className="h-4 w-4" /> {t('udhaar.detail.promise')}
                  </Button>
                  <Button variant="ghost" onClick={() => setSheet('dispute')}>
                    <ShieldAlert className="h-4 w-4" /> {t('udhaar.detail.dispute')}
                  </Button>
                </div>
              </>
            )}

            {/* Customer: waiting banner */}
            {!isMerchant && u.status === 'REQUESTED' && (
              <div className="flex items-center gap-3 rounded-3xl bg-amber-50 p-4 text-amber-700 ring-1 ring-amber-100">
                <CalendarClock className="h-5 w-5" />
                <p className="text-sm font-medium">{t('udhaar.request.sent')}</p>
              </div>
            )}

            {/* Merchant: cash + adjustment on active udhaar */}
            {isMerchant && u.status === 'ACTIVE' && (
              <div className="grid grid-cols-2 gap-2">
                <Button variant="primary" onClick={() => setSheet('cash')}>
                  <HandCoins className="h-4 w-4" /> {t('merchant.recordCash')}
                </Button>
                <Button variant="ghost" onClick={() => setSheet('adjust')}>
                  <SlidersHorizontal className="h-4 w-4" /> {t('merchant.adjust')}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Evidence timeline */}
        <div>
          <h2 className="mb-2 px-1 font-display text-base font-bold text-ink-900">{t('udhaar.detail.timeline')}</h2>
          <Card padded={false} className="p-4">
            <ol className="relative space-y-4 border-l border-ink-100 pl-5">
              {events.length === 0 && <p className="text-sm text-ink-400">No events yet.</p>}
              {events.map((ev) => (
                <TimelineItem
                  key={ev.id}
                  ev={ev}
                  showRefund={isMerchant && ev.type === 'REPAYMENT' && Boolean((ev.metadata as { paymentId?: string } | null)?.paymentId)}
                  onRefund={() => {
                    const pid = (ev.metadata as { paymentId?: string }).paymentId!;
                    setRefundTarget({ paymentId: pid, amountPaise: ev.amountPaise ?? 0 });
                    setRefundAmount(ev.amountPaise ? String(ev.amountPaise / 100) : '');
                    setSheet('refund');
                  }}
                />
              ))}
            </ol>
          </Card>
        </div>
      </PageBody>

      {/* --- Sheets --- */}
      <BottomSheet
        open={sheet === 'promise'}
        onClose={closeSheet}
        title={t('udhaar.detail.promise')}
        footer={
          <Button fullWidth loading={promise.isPending} disabled={!promiseDate} onClick={doPromise}>
            {t('common.confirm')}
          </Button>
        }
      >
        <Field label="I will pay by">
          <Input type="date" value={promiseDate} onChange={(e) => setPromiseDate(e.target.value)} />
        </Field>
        <Field label={`${t('common.note')} (${t('common.optional')})`}>
          <Textarea value={promiseNote} onChange={(e) => setPromiseNote(e.target.value)} />
        </Field>
      </BottomSheet>

      <BottomSheet
        open={sheet === 'dispute'}
        onClose={closeSheet}
        title={t('udhaar.detail.dispute')}
        footer={
          <Button fullWidth variant="danger" loading={dispute.isPending} onClick={doDispute}>
            {t('udhaar.detail.dispute')}
          </Button>
        }
      >
        <Field label="What's wrong?">
          <select className="input" value={disputeCat} onChange={(e) => setDisputeCat(e.target.value as typeof disputeCat)}>
            {DISPUTE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c.replace(/_/g, ' ').toLowerCase()}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('common.note')}>
          <Textarea value={disputeDesc} onChange={(e) => setDisputeDesc(e.target.value)} placeholder="Describe the issue" />
        </Field>
      </BottomSheet>

      <BottomSheet
        open={sheet === 'cash'}
        onClose={closeSheet}
        title={t('merchant.recordCash')}
        footer={
          <Button fullWidth loading={cash.isPending} disabled={rupeesToPaise(cashAmount) <= 0} onClick={doCash}>
            {t('common.confirm')}
          </Button>
        }
      >
        <div className="mb-3 flex items-center justify-between rounded-2xl bg-ink-50 px-4 py-3 text-sm">
          <span className="text-ink-500">{t('common.outstanding')}</span>
          <Money paise={outstanding} />
        </div>
        <Field label={t('pay.amount')} hint="Amount received in cash from the customer.">
          <Input
            leading="₹"
            inputMode="decimal"
            value={cashAmount}
            onChange={(e) => setCashAmount(e.target.value.replace(/[^\d.]/g, ''))}
            placeholder="0"
            className="text-xl font-bold"
          />
        </Field>
        <button className="text-sm font-semibold text-brand-600" onClick={() => setCashAmount(String(outstanding / 100))}>
          {t('pay.full')}
        </button>
      </BottomSheet>

      <BottomSheet
        open={sheet === 'adjust'}
        onClose={closeSheet}
        title={t('merchant.adjust')}
        footer={
          <Button
            fullWidth
            loading={adjust.isPending}
            disabled={rupeesToPaise(adjAmount) <= 0 || !adjReason.trim()}
            onClick={doAdjust}
          >
            Post adjustment
          </Button>
        }
      >
        <p className="mb-3 text-sm text-ink-500">
          Adjustments never edit the original transaction — they post a new, audited correction to the ledger.
        </p>
        <div className="mb-4 grid grid-cols-2 gap-2">
          <button
            onClick={() => setAdjDir('decrease')}
            className={cn(
              'rounded-2xl border px-3 py-2.5 text-sm font-semibold',
              adjDir === 'decrease' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-ink-200 text-ink-600',
            )}
          >
            Reduce balance
          </button>
          <button
            onClick={() => setAdjDir('increase')}
            className={cn(
              'rounded-2xl border px-3 py-2.5 text-sm font-semibold',
              adjDir === 'increase' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-ink-200 text-ink-600',
            )}
          >
            Increase balance
          </button>
        </div>
        <Field label={t('common.amount')}>
          <Input
            leading="₹"
            inputMode="decimal"
            value={adjAmount}
            onChange={(e) => setAdjAmount(e.target.value.replace(/[^\d.]/g, ''))}
            placeholder="0"
          />
        </Field>
        <Field label={`${t('common.note')} (required)`}>
          <Textarea value={adjReason} onChange={(e) => setAdjReason(e.target.value)} placeholder="Reason for the correction" />
        </Field>
      </BottomSheet>

      <BottomSheet
        open={sheet === 'refund'}
        onClose={closeSheet}
        title={t('merchant.refund')}
        footer={
          <Button
            fullWidth
            variant="danger"
            loading={refund.isPending}
            disabled={rupeesToPaise(refundAmount) <= 0}
            onClick={doRefund}
          >
            {t('merchant.refund')}
          </Button>
        }
      >
        <Field label={t('common.amount')}>
          <Input
            leading="₹"
            inputMode="decimal"
            value={refundAmount}
            onChange={(e) => setRefundAmount(e.target.value.replace(/[^\d.]/g, ''))}
            placeholder="0"
          />
        </Field>
        <Field label={`${t('common.note')} (${t('common.optional')})`}>
          <Textarea value={refundReason} onChange={(e) => setRefundReason(e.target.value)} />
        </Field>
      </BottomSheet>
    </>
  );
}

function TimelineItem({
  ev,
  showRefund,
  onRefund,
}: {
  ev: UdhaarEvent;
  showRefund: boolean;
  onRefund: () => void;
}) {
  const meta = eventMeta(ev.type);
  const icon = useMemo(() => {
    switch (ev.type) {
      case 'REPAYMENT':
      case 'CASH_REPAYMENT':
        return <CircleDollarSign className="h-4 w-4" />;
      case 'CLEARED':
        return <CheckCircle2 className="h-4 w-4" />;
      case 'REFUND':
        return <Undo2 className="h-4 w-4" />;
      case 'ADJUSTMENT':
        return <SlidersHorizontal className="h-4 w-4" />;
      default:
        return <ReceiptText className="h-4 w-4" />;
    }
  }, [ev.type]);

  return (
    <li className="relative">
      <span
        className={cn(
          'absolute -left-[27px] flex h-5 w-5 items-center justify-center rounded-full text-white ring-4 ring-white',
          dotTone[meta.tone] ?? 'bg-ink-300',
        )}
      >
        <span className="scale-[0.6]">{icon}</span>
      </span>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink-900">{ev.title}</p>
          {ev.description && <p className="text-sm text-ink-500">{ev.description}</p>}
          <p className="mt-0.5 text-[11px] text-ink-400">{formatDateTime(ev.createdAt)}</p>
          {showRefund && (
            <button onClick={onRefund} className="mt-1 text-xs font-semibold text-rose-600">
              Refund this payment
            </button>
          )}
        </div>
        {typeof ev.amountPaise === 'number' && ev.amountPaise !== 0 && (
          <Money paise={Math.abs(ev.amountPaise)} size="sm" />
        )}
      </div>
    </li>
  );
}
