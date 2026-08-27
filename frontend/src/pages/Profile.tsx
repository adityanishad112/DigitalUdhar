import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, ShieldCheck, Store, UserRound } from 'lucide-react';
import { useMe, useSubmitIdentity } from '@/services/hooks';
import { useAuth } from '@/store/auth';
import { useUi } from '@/store/ui';
import { ApiError } from '@/lib/api';
import { TopBar } from '@/components/layout/TopBar';
import { PageBody } from '@/components/layout/PageBody';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Field, Input } from '@/components/ui/Input';
import { BottomSheet } from '@/components/ui/Modal';
import { LanguageSwitch } from '@/components/layout/LanguageSwitch';
import { useT } from '@/i18n';

const IDENTITY_METHODS = ['AADHAAR', 'PAN', 'DL', 'PASSPORT'] as const;

export function Profile() {
  const { t } = useT();
  const navigate = useNavigate();
  const logout = useAuth((s) => s.logout);
  const stored = useAuth((s) => s.user);
  const { data: me } = useMe();
  const user = me ?? stored;
  const pushToast = useUi((s) => s.pushToast);

  const [sheet, setSheet] = useState(false);
  const [method, setMethod] = useState<(typeof IDENTITY_METHODS)[number]>('AADHAAR');
  const [value, setValue] = useState('');
  const [consent, setConsent] = useState(false);
  const submitIdentity = useSubmitIdentity();

  if (!user) return null;

  const idStatus = user.identity?.status ?? 'UNVERIFIED';
  const verified = idStatus === 'VERIFIED';

  const submit = async () => {
    if (!consent || value.trim().length < 4) return;
    try {
      await submitIdentity.mutateAsync({ method, value: value.trim(), consent });
      pushToast({ kind: 'success', message: 'Identity submitted for verification' });
      setSheet(false);
      setValue('');
      setConsent(false);
    } catch (e) {
      pushToast({ kind: 'error', message: e instanceof ApiError ? e.message : 'Could not submit' });
    }
  };

  return (
    <>
      <TopBar title={t('nav.profile')} />
      <PageBody>
        <Card className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 font-display text-xl font-bold text-brand-600">
            {(user.name ?? '?').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-lg font-bold text-ink-900">{user.name ?? 'Unnamed'}</p>
            <p className="text-sm text-ink-500">+91 {user.mobile}</p>
          </div>
          <Badge tone="blue">{user.role}</Badge>
        </Card>

        {/* Merchant shop card */}
        {user.merchant && (
          <Card>
            <div className="flex items-center gap-3">
              <Store className="h-5 w-5 text-brand-600" />
              <div className="flex-1">
                <p className="font-semibold text-ink-900">{user.merchant.shopName}</p>
                <p className="text-sm text-ink-500">Shop status: {user.merchant.status}</p>
              </div>
            </div>
          </Card>
        )}

        {/* Identity verification (customers) */}
        {user.role === 'CUSTOMER' && (
          <Card>
            <div className="flex items-start gap-3">
              <ShieldCheck className={verified ? 'h-5 w-5 text-emerald-600' : 'h-5 w-5 text-ink-400'} />
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-ink-900">{t('profile.identity')}</p>
                  <Badge tone={verified ? 'green' : idStatus === 'PENDING' ? 'amber' : 'gray'}>
                    {verified ? t('profile.verified') : idStatus === 'PENDING' ? 'Pending' : t('profile.unverified')}
                  </Badge>
                </div>
                {user.identity?.maskedValue ? (
                  <p className="mt-1 text-sm text-ink-500">
                    {user.identity.method}: <span className="font-medium tracking-wider">{user.identity.maskedValue}</span>
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-ink-500">
                    Verify your identity so shops can extend you more credit. Your ID is encrypted and never shown in
                    full.
                  </p>
                )}
                {!verified && idStatus !== 'PENDING' && (
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => setSheet(true)}>
                    Verify now
                  </Button>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Language */}
        <div>
          <p className="label">{t('profile.language')}</p>
          <LanguageSwitch variant="row" />
        </div>

        <Button
          variant="outline"
          fullWidth
          className="!text-rose-600"
          onClick={() => {
            logout();
            navigate('/', { replace: true });
          }}
        >
          <LogOut className="h-4 w-4" /> {t('profile.logout')}
        </Button>

        <p className="pt-2 text-center text-xs text-ink-300">Digital Udhar · demo build</p>
      </PageBody>

      <BottomSheet
        open={sheet}
        onClose={() => setSheet(false)}
        title={t('profile.identity')}
        footer={
          <Button fullWidth loading={submitIdentity.isPending} disabled={!consent || value.trim().length < 4} onClick={submit}>
            <UserRound className="h-4 w-4" /> Submit for verification
          </Button>
        }
      >
        <Field label="ID type">
          <select
            className="input"
            value={method}
            onChange={(e) => setMethod(e.target.value as (typeof IDENTITY_METHODS)[number])}
          >
            {IDENTITY_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </Field>
        <Field label="ID number" hint="Stored encrypted. Shops only ever see the last few digits.">
          <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Enter ID number" />
        </Field>
        <label className="flex items-start gap-3 rounded-2xl bg-ink-50 p-3 text-sm text-ink-600">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5 h-5 w-5 rounded accent-brand-500"
          />
          I consent to Digital Udhar securely verifying this ID for credit purposes.
        </label>
      </BottomSheet>
    </>
  );
}
