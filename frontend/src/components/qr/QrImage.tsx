import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { cn } from '@/lib/cn';
import { Spinner } from '@/components/ui/Spinner';

/**
 * Renders `value` as a QR image (client-side, no network). Used to show a
 * merchant's payment/udhaar QR so a customer can scan it.
 */
export function QrImage({ value, size = 220, className }: { value: string; size?: number; className?: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    setDataUrl(null);
    setError(false);
    QRCode.toDataURL(value, {
      width: size * 2, // 2x for crisp rendering on retina
      margin: 1,
      color: { dark: '#0f1729', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    })
      .then((url) => alive && setDataUrl(url))
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, [value, size]);

  return (
    <div
      className={cn('flex items-center justify-center overflow-hidden rounded-3xl bg-white p-3 shadow-soft', className)}
      style={{ width: size + 24, height: size + 24 }}
    >
      {error ? (
        <span className="px-4 text-center text-sm text-rose-500">Could not render QR</span>
      ) : dataUrl ? (
        <img src={dataUrl} width={size} height={size} alt="QR code" className="rounded-xl" />
      ) : (
        <Spinner />
      )}
    </div>
  );
}
