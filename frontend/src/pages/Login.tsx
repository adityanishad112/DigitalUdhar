import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { useSendOtp, useVerifyOtp } from '@/services/hooks';
import { useAuth } from '@/store/auth';
import { useUi } from '@/store/ui';
import { homePathFor } from '@/App';
import type { Role } from '@/lib/types';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Input';
import { LanguageSwitch } from '@/components/layout/LanguageSwitch';
import { useT } from '@/i18n';
import { cn } from '@/lib/cn';

const ROLES: { value: Role; labelKey: 'login.role.customer' | 'login.role.merchant' | 'login.role.admin' }[] = [
  { value: 'CUSTOMER', labelKey: 'login.role.customer' },
  { value: 'MERCHANT', labelKey: 'login.role.merchant' },
  { value: 'ADMIN', labelKey: 'login.role.admin' },
];

export function Login() {
  const { t } = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const setSession = useAuth((s) => s.setSession);
  const pushToast = useUi((s) => s.pushToast);

  const presetRole = (location.state as { role?: Role } | null)?.role;
  const from = (location.state as { from?: string } | null)?.from;

  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [role, setRole] = useState<Role>(presetRole ?? 'CUSTOMER');
  const [mobile, setMobile] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [devOtp, setDevOtp] = useState<string | undefined>();

  const sendOtp = useSendOtp();
  const verifyOtp = useVerifyOtp();

  const mobileValid = /^\d{10}$/.test(mobile);

  const handleSend = async () => {
    if (!mobileValid) return;
    try {
      const res = await sendOtp.mutateAsync({ mobile, role });
      setDevOtp(res.devOtp);
      if (res.devOtp) setCode(res.devOtp); // prefill in dev so the demo is one tap
      setStep('otp');
    } catch (e) {
      pushToast({ kind: 'error', message: e instanceof ApiError ? e.message : 'Could not send OTP' });
    }
  };

  const handleVerify = async () => {
    if (code.length < 4) return;
    try {
      const res = await verifyOtp.mutateAsync({ mobile, role, code, name: name.trim() || undefined });
      setSession(res.token, res.user);
      navigate(from ?? homePathFor(res.user.role), { replace: true });
    } catch (e) {
      pushToast({ kind: 'error', message: e instanceof ApiError ? e.message : 'Invalid OTP' });
    }
  };

  return (
    <div className="app-frame min-h-dvh bg-ink-50">
      <div className="flex items-center justify-between bg-gradient-to-br from-brand-600 to-brand-500 px-5 pb-10 pt-6 text-white">
        <button
          onClick={() => (step === 'otp' ? setStep('phone') : navigate('/'))}
          className="-ml-1.5 rounded-full p-1.5 transition hover:bg-white/15"
          aria-label="Back"
        >
          <ArrowLeft className="h-6 w-6" />
        </button>
        <LanguageSwitch />
      </div>

      <div className="-mt-6 flex-1 rounded-t-4xl bg-ink-50 px-5 pt-6">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-extrabold text-ink-900">{t('login.title')}</h1>
          <p className="mt-1 text-sm text-ink-500">{t('login.subtitle')}</p>
        </div>

        {step === 'phone' ? (
          <div className="animate-fade-in">
            <Field label={t('login.role')}>
              <div className="grid grid-cols-3 gap-2">
                {ROLES.map((r) => (
                  <button
                    key={r.value}
                    onClick={() => setRole(r.value)}
                    className={cn(
                      'rounded-2xl border px-2 py-3 text-sm font-semibold transition',
                      role === r.value
                        ? 'border-brand-500 bg-brand-50 text-brand-700'
                        : 'border-ink-200 bg-white text-ink-600',
                    )}
                  >
                    {t(r.labelKey)}
                  </button>
                ))}
              </div>
            </Field>

            <Field label={t('login.mobile')} hint="Use any 10-digit number for this demo.">
              <Input
                leading="+91"
                inputMode="numeric"
                autoFocus
                maxLength={10}
                value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder={t('login.mobilePlaceholder')}
              />
            </Field>

            <Button fullWidth size="lg" disabled={!mobileValid} loading={sendOtp.isPending} onClick={handleSend}>
              {t('login.sendOtp')}
            </Button>
          </div>
        ) : (
          <div className="animate-fade-in">
            <p className="mb-4 text-sm text-ink-600">{t('login.otpSent', { mobile: `+91 ${mobile}` })}</p>

            {devOtp && (
              <div className="mb-4 flex items-center gap-2 rounded-2xl bg-brand-50 px-4 py-3 text-sm text-brand-700 ring-1 ring-brand-100">
                <ShieldCheck className="h-4 w-4" />
                <span>
                  {t('login.devOtp')}: <span className="font-bold tracking-widest">{devOtp}</span>
                </span>
              </div>
            )}

            <Field label={t('login.otp')}>
              <Input
                inputMode="numeric"
                autoFocus
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="••••••"
                className="text-center text-2xl font-bold tracking-[0.5em]"
              />
            </Field>

            <Field label={`${t('login.name')} (${t('common.optional')})`} hint="Only needed the first time you sign in.">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('login.namePlaceholder')} />
            </Field>

            <Button fullWidth size="lg" disabled={code.length < 4} loading={verifyOtp.isPending} onClick={handleVerify}>
              {t('login.verify')}
            </Button>

            <div className="mt-4 flex items-center justify-between text-sm">
              <button onClick={() => setStep('phone')} className="font-medium text-ink-500">
                {t('login.changeNumber')}
              </button>
              <button
                onClick={handleSend}
                disabled={sendOtp.isPending}
                className="font-semibold text-brand-600 disabled:opacity-50"
              >
                {t('login.resend')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
