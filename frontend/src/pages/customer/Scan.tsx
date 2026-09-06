import { useNavigate } from 'react-router-dom';
import { ArrowRight, Sparkles, Store } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import { PageBody } from '@/components/layout/PageBody';
import { QrScanner } from '@/components/qr/QrScanner';
import { useDemoAccounts } from '@/services/hooks';
import { useT } from '@/i18n';

export function Scan() {
  const { t } = useT();
  const navigate = useNavigate();
  const { data: demoData } = useDemoAccounts();

  const demoShops = demoData?.accounts.filter((a) => a.role === 'MERCHANT' && a.qrToken) ?? [];

  return (
    <>
      <TopBar title={t('scan.title')} back />
      <PageBody>
        <p className="px-1 text-sm text-ink-500">{t('scan.hint')}</p>
        <QrScanner onToken={(token) => navigate(`/app/shop/${encodeURIComponent(token)}`)} />

        {/* 1-Tap Simulated Scan for Demos & Desktop Testing */}
        {demoShops.length > 0 && (
          <div className="mt-6 rounded-2xl border border-brand-200 bg-brand-50/40 p-4 space-y-3 animate-fade-in">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-brand-600" />
              <h3 className="font-display text-xs font-bold text-ink-900 uppercase tracking-wide">
                Demo Stores — 1-Tap Simulated Scan
              </h3>
            </div>
            <p className="text-xs text-ink-500">
              Testing on laptop or without camera? Tap a shop counter QR below to simulate scanning:
            </p>
            <div className="space-y-2">
              {demoShops.map((shop) => (
                <button
                  key={shop.qrToken}
                  onClick={() => navigate(`/app/shop/${encodeURIComponent(shop.qrToken!)}`)}
                  className="flex w-full items-center justify-between rounded-xl bg-white p-3 text-left shadow-sm ring-1 ring-ink-100 hover:ring-brand-400 active:scale-[0.99] transition"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
                      <Store className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-display text-xs font-bold text-ink-900">{shop.shopName}</p>
                      <p className="text-[11px] text-ink-500">
                        {[shop.category, shop.city].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                  </div>
                  <span className="flex items-center gap-1 rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand-700">
                    Simulate Scan <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </PageBody>
    </>
  );
}
