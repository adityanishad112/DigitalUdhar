import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BadgeIndianRupee, CheckCircle2, Lock, PartyPopper, ShieldCheck, XCircle } from 'lucide-react';
import { useCreateOrder, useMe, useSimulatePayment, useUdhaarDetail, useVerifyPayment } from '@/services/hooks';
import { useUi } from '@/store/ui';
import { ApiError } from '@/lib/api';
import type { CreateOrderResult } from '@/lib/types';
import { rupeesToPaise } from '@/lib/money';
import { loadRazorpayScript } from '@/lib/razorpay';
import { TopBar } from '@/components/layout/TopBar';
import { PageBody } from '@/components/layout/PageBody';
import { Card } from '@/components/ui/Card';
import { Money } from '@/components/ui/Money';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { LoadingState } from '@/components/ui/states';
import { cn } from '@/lib/cn';
import { useT } from '@/i18n';
import { PaymentSimulatorModal } from '@/components/demo/PaymentSimulatorModal';

type Step = 'amount' | 'sandbox' | 'processing' | 'success' | 'failed';
const METHODS = ['UPI', 'CARD', 'NETBANKING'] as const;

export function Pay() {
  const { t } = useT();
  const { id } = useParams();
  const navigate = useNavigate();
  const pushToast = useUi((s) => s.pushToast);

  const me = useMe();
  const q = useUdhaarDetail(id ?? null);
  const createOrder = useCreateOrder();
  const verifyPayment = useVerifyPayment();
  const simulate = useSimulatePayment();

  const [step, setStep] = useState<Step>('amount');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<(typeof METHODS)[number]>('UPI');
  const [order, setOrder] = useState<CreateOrderResult | null>(null);
  const [cleared, setCleared] = useState(false);

  // Repayment is per-udhaar: the backend caps a payment at THIS udhaar's
  // outstanding, so the screen must show and offer the udhaar's own balance —
  // never the shop-level account total (which would break "Pay full").
  const outstanding = q.data?.udhaar.outstandingPaise ?? 0;
  const payPaise = rupeesToPaise(amount);
  const payValid = payPaise > 0 && payPaise <= outstanding;

  const startCheckout = async () => {
    if (!id || !payValid) return;
    try {
      const res = await createOrder.mutateAsync({ udhaarId: id, amountPaise: payPaise, method });
      setOrder(res);

      if (res.order.provider.toLowerCase() === 'razorpay') {
        const loaded = await loadRazorpayScript();
        if (!loaded || !window.Razorpay) {
          pushToast({ kind: 'error', message: 'Unable to load Razorpay checkout. Please check internet connection.' });
          return;
        }

        const rzp = new window.Razorpay({
          key: res.order.keyId,
          amount: res.order.amountPaise,
          currency: res.order.currency,
          name: 'JamaBaaki',
          description: `Repayment to ${q.data?.merchant?.shopName ?? 'Merchant'}`,
          order_id: res.order.gatewayOrderId,
          prefill: {
            name: me.data?.name ?? '',
            contact: me.data?.mobile ?? '',
          },
          theme: {
            color: '#12a082',
          },
          handler: async (response) => {
            setStep('processing');
            try {
              const verifyRes = await verifyPayment.mutateAsync({
                gatewayOrderId: response.razorpay_order_id,
                gatewayPaymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
              });
              const ok = verifyRes.result.paymentStatus === 'SUCCESS';
              if (ok) {
                setCleared(Boolean(verifyRes.result.cleared));
                setStep('success');
              } else {
                setStep('failed');
              }
            } catch (err) {
              pushToast({
                kind: 'error',
                message: err instanceof ApiError ? err.message : 'Payment verification failed',
              });
              setStep('failed');
            }
          },
          modal: {
            ondismiss: () => {
              setStep('amount');
            },
          },
        });

        rzp.on('payment.failed', (resp) => {
          pushToast({
            kind: 'error',
            message: resp.error?.description || 'Payment failed at gateway',
          });
          setStep('failed');
        });

        rzp.open();
      } else {
        setStep('sandbox');
      }
    } catch (e) {
      pushToast({ kind: 'error', message: e instanceof ApiError ? e.message : 'Could not start payment' });
    }
  };

  const runSimulation = async (outcome: 'success' | 'fail') => {
    if (!order) return;
    setStep('processing');
    try {
      // The server fires a signed webhook to itself and verifies it there.
      // We only ever reflect the server's processed result — never assume success.
      const res = await simulate.mutateAsync({ gatewayOrderId: order.order.gatewayOrderId, outcome });
      const ok = res.result.paymentStatus === 'SUCCESS';
      if (ok) {
        setCleared(Boolean(res.result.cleared));
        setStep('success');
      } else {
        setStep('failed');
      }
    } catch (e) {
      pushToast({ kind: 'error', message: e instanceof ApiError ? e.message : 'Payment could not be verified' });
      setStep('failed');
    }
  };

  if (q.isLoading) {
    return (
      <>
        <TopBar title={t('pay.title')} back />
        <LoadingState />
      </>
    );
  }

  return (
    <>
      <TopBar title={t('pay.title')} subtitle={q.data?.merchant?.shopName ?? undefined} back={step === 'amount'} />
      <PageBody>
        {step === 'amount' && (
          <div className="animate-fade-in space-y-4">
            <Card>
              <div className="flex items-center justify-between rounded-2xl bg-ink-50 px-4 py-3">
                <span className="text-sm text-ink-500">{t('common.outstanding')}</span>
                <Money paise={outstanding} size="lg" />
              </div>
              <div className="mt-4">
                <Field label={t('pay.amount')}>
                  <Input
                    leading="₹"
                    inputMode="decimal"
                    autoFocus
                    value={amount}
                    onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))}
                    placeholder="0"
                    className="text-2xl font-bold"
                    invalid={payPaise > outstanding}
                  />
                </Field>
                <button
                  className="mb-4 -mt-2 text-sm font-semibold text-brand-600"
                  onClick={() => setAmount(String(outstanding / 100))}
                >
                  {t('pay.full')}
                </button>

                <Field label="Method">
                  <div className="grid grid-cols-3 gap-2">
                    {METHODS.map((m) => (
                      <button
                        key={m}
                        onClick={() => setMethod(m)}
                        className={cn(
                          'rounded-2xl border px-2 py-2.5 text-sm font-semibold transition',
                          method === m ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-ink-200 text-ink-600',
                        )}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </Field>
              </div>
            </Card>

            <Button variant="accent" size="lg" fullWidth loading={createOrder.isPending} disabled={!payValid} onClick={startCheckout}>
              <Lock className="h-5 w-5" /> {t('pay.payNow')}
            </Button>
            <p className="flex items-center justify-center gap-1.5 text-xs text-ink-400">
              <ShieldCheck className="h-3.5 w-3.5" /> {t('pay.sandboxNote')}
            </p>
          </div>
        )}

        {step === 'sandbox' && order && (
          <PaymentSimulatorModal
            order={order}
            shopName={q.data?.merchant?.shopName}
            isProcessing={simulate.isPending}
            onSimulate={runSimulation}
            onClose={() => setStep('amount')}
          />
        )}

        {step === 'processing' && (
          <div className="flex flex-col items-center justify-center gap-4 py-24">
            <Spinner size={36} />
            <p className="font-medium text-ink-600">{t('pay.processing')}</p>
            <p className="max-w-[15rem] text-center text-xs text-ink-400">
              Verifying the gateway webhook signature on the server…
            </p>
          </div>
        )}

        {step === 'success' && (
          <div className="animate-scale-in flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-emerald-500">
              {cleared ? <PartyPopper className="h-10 w-10" /> : <CheckCircle2 className="h-10 w-10" />}
            </div>
            <h2 className="mt-5 font-display text-xl font-extrabold text-ink-900">{t('pay.success')}</h2>
            {cleared ? (
              <p className="mt-1 font-semibold text-emerald-600">{t('pay.cleared')}</p>
            ) : (
              <p className="mt-1 text-ink-500">
                {t('common.paid')} <Money paise={payPaise} size="sm" />
              </p>
            )}
            <Button className="mt-8" size="lg" onClick={() => navigate(`/app/udhaar/${id}`, { replace: true })}>
              <BadgeIndianRupee className="h-5 w-5" /> View receipt & khata
            </Button>
          </div>
        )}

        {step === 'failed' && (
          <div className="animate-scale-in flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-rose-50 text-rose-500">
              <XCircle className="h-10 w-10" />
            </div>
            <h2 className="mt-5 font-display text-xl font-extrabold text-ink-900">Payment failed</h2>
            <p className="mt-1 max-w-[16rem] text-ink-500">No money was deducted. You can try again.</p>
            <div className="mt-8 flex w-full flex-col gap-2">
              <Button size="lg" onClick={() => (order?.order.provider.toLowerCase() === 'razorpay' ? setStep('amount') : setStep('sandbox'))}>
                Try again
              </Button>
              <Button variant="ghost" onClick={() => navigate(`/app/udhaar/${id}`, { replace: true })}>
                {t('common.back')}
              </Button>
            </div>
          </div>
        )}
      </PageBody>
    </>
  );
}
