import { useState } from 'react';
import QRCode from 'qrcode';
import { Copy, Download, Plus, QrCode as QrIcon, Trash2 } from 'lucide-react';
import { useGenerateQr, useMyQrs, useRevokeQr } from '@/services/hooks';
import type { Qr } from '@/lib/types';
import { useUi } from '@/store/ui';
import { ApiError } from '@/lib/api';
import { TopBar } from '@/components/layout/TopBar';
import { PageBody } from '@/components/layout/PageBody';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { BottomSheet } from '@/components/ui/Modal';
import { Field, Input } from '@/components/ui/Input';
import { QrImage } from '@/components/qr/QrImage';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useT } from '@/i18n';

/** Deep link a QR encodes (server sends it as `payload`; fall back just in case). */
function qrValue(qr: Qr): string {
  return qr.payload ?? `${window.location.origin}/s/${qr.token}`;
}

export function QrManage() {
  const { t } = useT();
  const pushToast = useUi((s) => s.pushToast);
  const q = useMyQrs();
  const generate = useGenerateQr();
  const revoke = useRevokeQr();

  const [genOpen, setGenOpen] = useState(false);
  const [label, setLabel] = useState('');

  const qrs = q.data ?? [];
  const active = qrs.filter((x) => x.status !== 'REVOKED');
  const primary = active[0];

  const onGenerate = async () => {
    try {
      await generate.mutateAsync(label.trim() || undefined);
      pushToast({ kind: 'success', message: 'New QR generated' });
      setGenOpen(false);
      setLabel('');
    } catch (e) {
      pushToast({ kind: 'error', message: e instanceof ApiError ? e.message : 'Could not generate QR' });
    }
  };

  const onRevoke = async (qr: Qr) => {
    try {
      await revoke.mutateAsync(qr.token);
      pushToast({ kind: 'info', message: 'QR revoked' });
    } catch (e) {
      pushToast({ kind: 'error', message: e instanceof ApiError ? e.message : 'Could not revoke QR' });
    }
  };

  const onDownload = async (qr: Qr) => {
    try {
      const url = await QRCode.toDataURL(qrValue(qr), {
        width: 720,
        margin: 2,
        color: { dark: '#0f1729', light: '#ffffff' },
      });
      const a = document.createElement('a');
      a.href = url;
      a.download = `digital-udhar-qr-${qr.token.slice(0, 8)}.png`;
      a.click();
    } catch {
      pushToast({ kind: 'error', message: 'Could not prepare download' });
    }
  };

  const onCopy = async (qr: Qr) => {
    try {
      await navigator.clipboard.writeText(qrValue(qr));
      pushToast({ kind: 'success', message: 'Link copied' });
    } catch {
      pushToast({ kind: 'error', message: 'Could not copy link' });
    }
  };

  return (
    <>
      <TopBar
        title={t('qr.title')}
        right={
          <button
            onClick={() => setGenOpen(true)}
            className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold"
          >
            <Plus className="h-4 w-4" /> {t('qr.generate')}
          </button>
        }
      />
      <PageBody>
        {q.isLoading ? (
          <LoadingState />
        ) : q.isError ? (
          <ErrorState onRetry={() => q.refetch()} />
        ) : qrs.length === 0 ? (
          <EmptyState
            icon={<QrIcon className="h-7 w-7" />}
            title="No QR yet"
            description={t('qr.hint')}
            action={
              <Button size="sm" onClick={() => setGenOpen(true)}>
                <Plus className="h-4 w-4" /> {t('qr.generate')}
              </Button>
            }
          />
        ) : (
          <>
            {primary && (
              <Card className="flex flex-col items-center text-center">
                <p className="text-sm text-ink-500">{t('qr.hint')}</p>
                <div className="my-4">
                  <QrImage value={qrValue(primary)} size={220} />
                </div>
                <p className="font-semibold text-ink-900">{primary.label ?? 'Shop QR'}</p>
                <div className="mt-4 grid w-full grid-cols-2 gap-2.5">
                  <Button variant="outline" onClick={() => onDownload(primary)}>
                    <Download className="h-5 w-5" /> {t('qr.download')}
                  </Button>
                  <Button variant="ghost" onClick={() => onCopy(primary)}>
                    <Copy className="h-5 w-5" /> Copy link
                  </Button>
                </div>
              </Card>
            )}

            {/* All QRs with management actions */}
            <div className="space-y-2">
              {qrs.map((qr) => {
                const revoked = qr.status === 'REVOKED';
                return (
                  <div key={qr.id} className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-soft">
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                      <QrIcon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-ink-900">{qr.label ?? 'Shop QR'}</p>
                      <p className="truncate text-[11px] text-ink-400">{qr.token}</p>
                    </div>
                    <StatusBadge
                      meta={{ label: revoked ? 'Revoked' : 'Active', tone: revoked ? 'gray' : 'green' }}
                      dot
                    />
                    {!revoked && (
                      <button
                        onClick={() => onRevoke(qr)}
                        className="rounded-full p-2 text-ink-400 transition hover:bg-rose-50 hover:text-rose-500"
                        aria-label={t('qr.revoke')}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </PageBody>

      <BottomSheet
        open={genOpen}
        onClose={() => setGenOpen(false)}
        title={t('qr.generate')}
        footer={
          <Button fullWidth loading={generate.isPending} onClick={onGenerate}>
            {t('qr.generate')}
          </Button>
        }
      >
        <Field label="Label" hint={t('common.optional')}>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Counter 1" maxLength={60} />
        </Field>
        <p className="text-xs text-ink-400">Customers scan this QR to open your shop and take udhaar.</p>
      </BottomSheet>
    </>
  );
}
