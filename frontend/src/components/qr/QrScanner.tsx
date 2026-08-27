import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Keyboard, CameraOff } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Input';

/**
 * The QR payload our app encodes is a deep link: `${appBaseUrl}/s/${token}`.
 * We accept either that full URL or a bare token, and hand the caller the token.
 */
export function extractToken(raw: string): string {
  const s = raw.trim();
  const m = s.match(/\/s\/([^/?#\s]+)/);
  if (m) return decodeURIComponent(m[1]);
  return s;
}

const REGION_ID = 'qr-reader';

export function QrScanner({ onToken }: { onToken: (token: string) => void }) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const handledRef = useRef(false);
  const [cameraError, setCameraError] = useState(false);
  const [manual, setManual] = useState(false);
  const [manualValue, setManualValue] = useState('');

  useEffect(() => {
    if (manual) return;
    handledRef.current = false;
    const scanner = new Html5Qrcode(REGION_ID, { verbose: false });
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decoded) => {
          if (handledRef.current) return;
          handledRef.current = true;
          // Stop the camera before handing control back to the caller.
          scanner.stop().catch(() => {});
          onToken(extractToken(decoded));
        },
        () => {
          /* per-frame decode failures are normal; ignore */
        },
      )
      .catch(() => setCameraError(true));

    return () => {
      const s = scannerRef.current;
      if (s && s.isScanning) s.stop().catch(() => {});
      scannerRef.current = null;
    };
  }, [manual, onToken]);

  if (manual || cameraError) {
    return (
      <div className="animate-fade-in">
        {cameraError && !manual && (
          <div className="mb-4 flex items-center gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700 ring-1 ring-amber-100">
            <CameraOff className="h-4 w-4 shrink-0" />
            Camera unavailable. Enter the shop code manually.
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const t = extractToken(manualValue);
            if (t) onToken(t);
          }}
        >
          <Field label="Shop code or QR link" hint="Paste the code shown under the shop's QR.">
            <Input
              autoFocus
              value={manualValue}
              onChange={(e) => setManualValue(e.target.value)}
              placeholder="e.g. QR-XXXXXXXX or the /s/ link"
            />
          </Field>
          <Button type="submit" fullWidth disabled={!manualValue.trim()}>
            Continue
          </Button>
        </form>
        {!cameraError && (
          <button
            type="button"
            onClick={() => setManual(false)}
            className="mt-3 w-full text-center text-sm font-medium text-brand-600"
          >
            Use camera instead
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="overflow-hidden rounded-3xl bg-ink-900 shadow-card">
        <div id={REGION_ID} className="w-full [&_video]:rounded-3xl" />
      </div>
      <p className="mt-3 text-center text-sm text-ink-500">Point your camera at the shop's QR code.</p>
      <button
        type="button"
        onClick={() => setManual(true)}
        className="mx-auto mt-3 flex items-center gap-2 text-sm font-medium text-brand-600"
      >
        <Keyboard className="h-4 w-4" /> Enter code manually
      </button>
    </div>
  );
}
