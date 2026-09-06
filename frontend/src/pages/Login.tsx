import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { useDemoQuickLogin, useSendOtp, useVerifyOtp } from '@/services/hooks';
import { useAuth } from '@/store/auth';
import { useUi } from '@/store/ui';
import { homePathFor } from '@/App';
import type { Role } from '@/lib/types';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Input';
import { LanguageSwitch } from '@/components/layout/LanguageSwitch';
import { DemoBar } from '@/components/demo/DemoBar';
import { useT } from '@/i18n';
import { cn } from '@/lib/cn';

const ROLES: { value: Role; labelKey: 'login.role.customer' | 'login.role.merchant' | 'login.role.admin' }[] = [
  { value: 'CUSTOMER', labelKey: 'login.role.customer' },
  { value: 'MERCHANT', labelKey: 'login.role.merchant' },
  { value: 'ADMIN', labelKey: 'login.role.admin' },
];

const DEMO_ACCOUNTS: { role: Role; mobile: string; name: string; tag: string }[] = [
  { role: 'CUSTOMER', mobile: '8000000001', name: 'Rahul Kumar', tag: 'Customer' },
  { role: 'MERCHANT', mobile: '9000000001', name: 'Rajesh Sharma', tag: 'Sharma Store' },
  { role: 'MERCHANT', mobile: '9000000002', name: 'Suresh Gupta', tag: 'Gupta Store' },
  { role: 'ADMIN', mobile: '9999900000', name: 'Platform Admin', tag: 'Admin' },
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
  const quickLogin = useDemoQuickLogin();

  const handleMobileChange = (raw: string) => {
    let clean = raw.trim();
    if (clean.startsWith('+91')) {
      clean = clean.slice(3);
    }
    let digits = clean.replace(/\D/g, '');
    if (digits.length === 12 && digits.startsWith('91')) {
      digits = digits.slice(2);
    } else if (digits.length === 11 && digits.startsWith('0')) {
      digits = digits.slice(1);
    }
    setMobile(digits.slice(0, 10));
  };

  const mobileValid = /^\d{10}$/.test(mobile);

  const handleSend = async (overrideMobile?: string, overrideRole?: Role) => {
    const targetMobile = overrideMobile ?? mobile;
    const targetRole = overrideRole ?? role;

    if (!/^\d{10}$/.test(targetMobile)) return;
    try {
      const res = await sendOtp.mutateAsync({ mobile: targetMobile, role: targetRole });
      setDevOtp(res.devOtp);
      if (res.devOtp) setCode(res.devOtp); // prefill in dev so the demo is one tap
      setStep('otp');
    } catch (e) {
      pushToast({ kind: 'error', message: e instanceof ApiError ? e.message : 'Could not send OTP' });
    }
  };

  const handleQuickDemo = async (demo: (typeof DEMO_ACCOUNTS)[0]) => {
    try {
      const res = await quickLogin.mutateAsync({ mobile: demo.mobile, role: demo.role });
      setSession(res.token, res.user);
      pushToast({ kind: 'success', message: `Signed in as ${res.user.name ?? demo.name}` });
      navigate(from ?? homePathFor(res.user.role), { replace: true });
    } catch {
      setRole(demo.role);
      setMobile(demo.mobile);
      handleSend(demo.mobile, demo.role);
    }
  };

  const handleVerify = async () => {
    if (code.length !== 6) {
      pushToast({ kind: 'error', message: 'OTP must be 6 digits' });
      return;
    }
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
          onClick={() => {
            if (step === 'otp') {
              setStep('phone');
              setCode('');
              setDevOtp(undefined);
            } else {
              navigate('/');
            }
          }}
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
          <div className="animate-fade-in space-y-4">
            <Field label={t('login.role')}>
              <div className="grid grid-cols-3 gap-2">
                {ROLES.map((r) => (
                  <button
                    key={r.value}
                    type="button"
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

            <Field label={t('login.mobile')} hint="Use any 10-digit number or select a demo account below.">
              <Input
                leading="+91"
                inputMode="numeric"
                autoFocus
                maxLength={14}
                value={mobile}
                onChange={(e) => handleMobileChange(e.target.value)}
                placeholder={t('login.mobilePlaceholder')}
              />
            </Field>

            <Button fullWidth size="lg" disabled={!mobileValid} loading={sendOtp.isPending} onClick={() => handleSend()}>
              {t('login.sendOtp')}
            </Button>

            {/* Quick Demo Logins */}
            <div className="pt-4 border-t border-ink-200">
              <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-ink-400">
                ⚡ Quick Demo Accounts (1-Tap Sign In)
              </p>
              <div className="grid grid-cols-2 gap-2">
                {DEMO_ACCOUNTS.map((d) => (
                  <button
                    key={d.mobile + d.role}
                    type="button"
                    onClick={() => handleQuickDemo(d)}
                    disabled={sendOtp.isPending}
                    className="flex flex-col items-start rounded-xl border border-ink-200 bg-white p-2.5 text-left transition hover:border-brand-300 hover:bg-brand-50/50"
                  >
                    <span className="text-xs font-bold text-ink-900">{d.name}</span>
                    <span className="text-[11px] text-ink-500">{d.tag} · {d.mobile}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="animate-fade-in space-y-4">
            <p className="text-sm text-ink-600">{t('login.otpSent', { mobile: `+91 ${mobile}` })}</p>

            {devOtp && (
              <div className="flex items-center justify-between rounded-2xl bg-brand-50 px-4 py-3 text-sm text-brand-700 ring-1 ring-brand-100">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-brand-600" />
                  <span>
                    {t('login.devOtp')}: <span className="font-bold tracking-widest">{devOtp}</span>
                  </span>
                </div>
                {code !== devOtp && (
                  <button
                    type="button"
                    onClick={() => setCode(devOtp)}
                    className="text-xs font-bold text-brand-600 underline"
                  >
                    Fill
                  </button>
                )}
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

            <Button fullWidth size="lg" disabled={code.length !== 6} loading={verifyOtp.isPending} onClick={handleVerify}>
              {t('login.verify')}
            </Button>

            <div className="flex items-center justify-between text-sm pt-2">
              <button
                type="button"
                onClick={() => {
                  setStep('phone');
                  setCode('');
                  setDevOtp(undefined);
                }}
                className="font-medium text-ink-500 hover:text-ink-700"
              >
                {t('login.changeNumber')}
              </button>
              <button
                type="button"
                onClick={() => handleSend()}
                disabled={sendOtp.isPending}
                className="font-semibold text-brand-600 hover:text-brand-700 disabled:opacity-50"
              >
                {t('login.resend')}
              </button>
            </div>
          </div>
        )}
      </div>
      <DemoBar />
    </div>
  );
}
