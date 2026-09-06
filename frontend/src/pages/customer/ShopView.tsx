import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { addDays, format } from 'date-fns';
import { AlertTriangle, MapPin, Plus, Store, Trash2 } from 'lucide-react';
import { useRequestUdhaar, useResolveQr } from '@/services/hooks';
import { useUi } from '@/store/ui';
import { ApiError } from '@/lib/api';
import { rupeesToPaise } from '@/lib/money';
import { TopBar } from '@/components/layout/TopBar';
import { PageBody } from '@/components/layout/PageBody';
import { Card } from '@/components/ui/Card';
import { Money } from '@/components/ui/Money';
import { Button } from '@/components/ui/Button';
import { Field, Input, Textarea } from '@/components/ui/Input';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { useT } from '@/i18n';

interface DraftItem {
  name: string;
  qty: string;
  price: string;
}

const DEMO_PRESETS = [
  {
    label: 'Weekly Ration (₹1,500)',
    amount: '1500',
    note: 'Weekly essentials: Atta, Rice & Oil',
    items: [
      { name: 'Atta 10kg', qty: '1', price: '450' },
      { name: 'Basmati Rice 10kg', qty: '1', price: '600' },
      { name: 'Mustard Oil 2L', qty: '2', price: '450' },
    ],
  },
  {
    label: 'Snacks & Drinks (₹250)',
    amount: '250',
    note: 'Evening snacks & biscuits',
    items: [
      { name: 'Cold Drinks 2L', qty: '1', price: '95' },
      { name: 'Namkeen & Chips', qty: '3', price: '95' },
      { name: 'Biscuits pack', qty: '2', price: '60' },
    ],
  },
  {
    label: 'Dairy & Bread (₹140)',
    amount: '140',
    note: 'Fresh morning milk & bread',
    items: [
      { name: 'Full Cream Milk 1L', qty: '1', price: '70' },
      { name: 'Sandwich Bread', qty: '1', price: '45' },
      { name: 'Eggs (6 pcs)', qty: '1', price: '25' },
    ],
  },
];

export function ShopView() {
  const { t } = useT();
  const { token } = useParams();
  const navigate = useNavigate();
  const pushToast = useUi((s) => s.pushToast);

  const q = useResolveQr(token ?? null);
  const requestUdhaar = useRequestUdhaar();

  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [note, setNote] = useState('');
  const [items, setItems] = useState<DraftItem[]>([]);

  const merchant = q.data?.merchant;
  const account = q.data?.myAccount;

  // Default the due date once the account (with its terms) loads.
  const defaultDue = useMemo(
    () => (account ? format(addDays(new Date(), account.termsDays || 15), 'yyyy-MM-dd') : ''),
    [account],
  );
  const effectiveDue = dueDate || defaultDue;

  const principalPaise = rupeesToPaise(amount);
  // Display-only headroom check. The authoritative limitExceeded flag is set by
  // the backend on the created udhaar — this is just an early hint to the user.
  const wouldExceed =
    account && principalPaise > 0 && account.outstandingPaise + principalPaise > account.creditLimitPaise;

  const submit = async () => {
    if (!merchant || principalPaise <= 0) return;
    const cleanItems = items
      .filter((i) => i.name.trim())
      .map((i) => ({
        name: i.name.trim(),
        qty: i.qty ? Number(i.qty) : undefined,
        pricePaise: i.price ? rupeesToPaise(i.price) : undefined,
      }));
    try {
      const udhaar = await requestUdhaar.mutateAsync({
        merchantId: merchant.id,
        principalPaise,
        dueDate: effectiveDue || undefined,
        note: note.trim() || undefined,
        items: cleanItems.length ? cleanItems : undefined,
      });
      pushToast({ kind: 'success', message: t('udhaar.request.sent') });
      navigate(`/app/udhaar/${udhaar.id}`, { replace: true });
    } catch (e) {
      pushToast({ kind: 'error', message: e instanceof ApiError ? e.message : 'Could not send request' });
    }
  };

  if (q.isLoading) {
    return (
      <>
        <TopBar title={t('scan.title')} back />
        <LoadingState />
      </>
    );
  }

  if (q.isError || !merchant || !account) {
    return (
      <>
        <TopBar title={t('scan.title')} back />
        <ErrorState title={t('scan.invalid')} onRetry={() => navigate('/app/scan')} />
      </>
    );
  }

  return (
    <>
      <TopBar title={t('shop.takeUdhaar')} back />
      <PageBody>
        {/* Shop card */}
        <Card>
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
              <Store className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-display text-lg font-bold text-ink-900">{merchant.shopName}</p>
              {(merchant.city || merchant.category) && (
                <p className="flex items-center gap-1 text-sm text-ink-500">
                  <MapPin className="h-3.5 w-3.5" />
                  {[merchant.category, merchant.city].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-ink-50 p-3">
            <div>
              <p className="text-xs text-ink-500">{t('shop.yourBalance')}</p>
              <Money paise={account.outstandingPaise} size="lg" />
            </div>
            <div>
              <p className="text-xs text-ink-500">{t('shop.creditLimit')}</p>
              <Money paise={account.creditLimitPaise} size="lg" tone="muted" />
            </div>
          </div>
          {!account.hasRelationship && (
            <p className="mt-2 text-xs text-brand-600">{t('shop.newRelationship')}</p>
          )}
        </Card>

        {/* Take udhaar form */}
        <Card>
          {/* Demo Quick Presets */}
          <div className="mb-4">
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink-400">⚡ Demo Quick Presets</span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {DEMO_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    setAmount(preset.amount);
                    setNote(preset.note);
                    setItems(preset.items);
                  }}
                  className="rounded-xl border border-brand-200 bg-brand-50/60 px-2.5 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-100 transition"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <Field label={t('udhaar.request.amount')}>
            <Input
              leading="₹"
              inputMode="decimal"
              autoFocus
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))}
              placeholder="0"
              className="text-2xl font-bold"
            />
          </Field>

          {wouldExceed && (
            <div className="mb-4 -mt-1 flex items-start gap-2 rounded-2xl bg-amber-50 px-3 py-2.5 text-sm text-amber-700 ring-1 ring-amber-100">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {t('udhaar.request.limitWarn')}
            </div>
          )}

          <Field label={t('udhaar.request.due')}>
            <Input type="date" value={effectiveDue} onChange={(e) => setDueDate(e.target.value)} />
          </Field>

          {/* Optional items */}
          <div className="mb-4">
            <p className="label">{t('udhaar.request.items')}</p>
            <div className="space-y-2">
              {items.map((it, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    value={it.name}
                    onChange={(e) =>
                      setItems((arr) => arr.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x)))
                    }
                    placeholder={t('udhaar.request.itemName')}
                    className="flex-1"
                  />
                  <Input
                    value={it.price}
                    onChange={(e) =>
                      setItems((arr) =>
                        arr.map((x, i) => (i === idx ? { ...x, price: e.target.value.replace(/[^\d.]/g, '') } : x)),
                      )
                    }
                    inputMode="decimal"
                    placeholder="₹"
                    className="w-20"
                  />
                  <button
                    onClick={() => setItems((arr) => arr.filter((_, i) => i !== idx))}
                    className="rounded-xl p-2 text-ink-400 hover:bg-ink-100"
                    aria-label="Remove item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => setItems((arr) => [...arr, { name: '', qty: '', price: '' }])}
                className="flex items-center gap-1.5 text-sm font-semibold text-brand-600"
              >
                <Plus className="h-4 w-4" /> {t('udhaar.request.addItem')}
              </button>
            </div>
          </div>

          <Field label={`${t('udhaar.request.note')} (${t('common.optional')})`}>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. groceries for the week" />
          </Field>

          <Button
            fullWidth
            size="lg"
            variant="accent"
            loading={requestUdhaar.isPending}
            disabled={principalPaise <= 0}
            onClick={submit}
          >
            {t('udhaar.request.submit')}
          </Button>
        </Card>
      </PageBody>
    </>
  );
}
