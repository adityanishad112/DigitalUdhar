import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowRight, QrCode, ReceiptText, ShieldCheck, Store, Wallet } from 'lucide-react';
import { useAuth } from '@/store/auth';
import { homePathFor } from '@/App';
import { Button } from '@/components/ui/Button';
import { LanguageSwitch } from '@/components/layout/LanguageSwitch';
import { useT } from '@/i18n';

const STEPS = [
  { icon: QrCode, text: 'Scan shop QR' },
  { icon: Wallet, text: 'Take udhaar' },
  { icon: ShieldCheck, text: 'Shop accepts' },
  { icon: ReceiptText, text: 'Pay & clear' },
];

export function Landing() {
  const { t } = useT();
  const navigate = useNavigate();
  const user = useAuth((s) => s.user);
  const token = useAuth((s) => s.token);

  // Already signed in → straight to the right dashboard.
  if (token && user) return <Navigate to={homePathFor(user.role)} replace />;

  const go = (role: 'CUSTOMER' | 'MERCHANT') => navigate('/login', { state: { role } });

  return (
    <div className="app-frame min-h-dvh bg-gradient-to-b from-brand-600 via-brand-500 to-brand-600 text-white">
      <div className="flex items-center justify-between px-5 pt-5">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white/15 font-display text-lg font-extrabold backdrop-blur">
            ₹
          </span>
          <span className="font-display text-lg font-extrabold tracking-tight">{t('app.name')}</span>
        </div>
        <LanguageSwitch />
      </div>

      <div className="flex flex-1 flex-col justify-center px-6 py-10">
        <h1 className="font-display text-[2.6rem] font-extrabold leading-[1.05] tracking-tight animate-fade-in">
          Scan.
          <br />
          Take Udhaar.
          <br />
          <span className="text-accent-300">Pay Later.</span>
        </h1>
        <p className="mt-4 max-w-xs text-[15px] leading-relaxed text-white/85">
          Verified digital udhaar for everyday shops. Every transaction is agreed by both sides, recorded on an
          immutable ledger, and cleared with secure payments.
        </p>

        <div className="mt-8 grid grid-cols-2 gap-3">
          {STEPS.map((s, i) => (
            <div
              key={s.text}
              className="flex items-center gap-3 rounded-2xl bg-white/10 px-3.5 py-3 backdrop-blur animate-fade-in"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <s.icon className="h-5 w-5 text-accent-300" />
              <span className="text-sm font-semibold">{s.text}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3 rounded-t-4xl bg-white px-6 pb-8 pt-6 text-ink-900 shadow-card-lg">
        <Button variant="primary" size="lg" fullWidth onClick={() => go('CUSTOMER')}>
          <Wallet className="h-5 w-5" /> {t('login.role.customer')}
          <ArrowRight className="ml-auto h-5 w-5" />
        </Button>
        <Button variant="outline" size="lg" fullWidth onClick={() => go('MERCHANT')}>
          <Store className="h-5 w-5" /> {t('login.role.merchant')}
          <ArrowRight className="ml-auto h-5 w-5" />
        </Button>
        <p className="pt-1 text-center text-xs text-ink-400">
          By continuing you agree to fair-use of this demo.{' '}
          <Link to="/login" className="font-semibold text-brand-600">
            Admin / staff login
          </Link>
        </p>
      </div>
    </div>
  );
}
