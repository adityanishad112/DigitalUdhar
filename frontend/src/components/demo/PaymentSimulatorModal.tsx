import { useState } from 'react';
import {
  AlertCircle,
  Building2,
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  Delete,
  KeyRound,
  Lock,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  X,
  XCircle,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Money } from '@/components/ui/Money';
import { Field, Input } from '@/components/ui/Input';
import type { CreateOrderResult } from '@/lib/types';
import { cn } from '@/lib/cn';

interface PaymentSimulatorModalProps {
  order: CreateOrderResult;
  shopName?: string;
  onSimulate: (outcome: 'success' | 'fail') => Promise<void>;
  onClose: () => void;
  isProcessing: boolean;
}

type Tab = 'upi' | 'card' | 'netbanking' | 'dev';

const UPI_APPS = [
  { id: 'gpay', name: 'Google Pay', color: 'bg-blue-500 text-white', handle: 'okhdfcbank' },
  { id: 'phonepe', name: 'PhonePe', color: 'bg-purple-600 text-white', handle: 'ybl' },
  { id: 'paytm', name: 'Paytm', color: 'bg-sky-500 text-white', handle: 'paytm' },
  { id: 'bhim', name: 'BHIM UPI', color: 'bg-emerald-600 text-white', handle: 'upi' },
  { id: 'cred', name: 'CRED UPI', color: 'bg-zinc-800 text-white', handle: 'axisbank' },
];

const BANKS = [
  { id: 'sbi', name: 'State Bank of India', code: 'SBI' },
  { id: 'hdfc', name: 'HDFC Bank', code: 'HDFC' },
  { id: 'icici', name: 'ICICI Bank', code: 'ICICI' },
  { id: 'axis', name: 'Axis Bank', code: 'AXIS' },
  { id: 'kotak', name: 'Kotak Mahindra', code: 'KOTAK' },
  { id: 'pnb', name: 'Punjab National Bank', code: 'PNB' },
];

export function PaymentSimulatorModal({
  order,
  shopName,
  onSimulate,
  onClose,
  isProcessing,
}: PaymentSimulatorModalProps) {
  const [tab, setTab] = useState<Tab>('upi');

  // UPI State
  const [selectedApp, setSelectedApp] = useState(UPI_APPS[0]);
  const [upiId, setUpiId] = useState('rahulkumar@okhdfcbank');
  const [showUpiPinModal, setShowUpiPinModal] = useState(false);
  const [upiPin, setUpiPin] = useState('');

  // Card State
  const [cardNumber, setCardNumber] = useState('4111 1111 1111 1111');
  const [cardHolder, setCardHolder] = useState('Rahul Kumar');
  const [cardExpiry, setCardExpiry] = useState('12/28');
  const [cardCvv, setCardCvv] = useState('888');
  const [showCardOtpModal, setShowCardOtpModal] = useState(false);
  const [cardOtp, setCardOtp] = useState('');

  // Netbanking State
  const [selectedBank, setSelectedBank] = useState(BANKS[0].id);

  // Dev tab copy state
  const [copied, setCopied] = useState(false);

  const amountPaise = order.order.amountPaise;

  const handleKeypadPress = (val: string) => {
    if (upiPin.length < 4) {
      setUpiPin((prev) => prev + val);
    }
  };

  const handleKeypadBackspace = () => {
    setUpiPin((prev) => prev.slice(0, -1));
  };

  const handleUpiSubmit = async () => {
    setShowUpiPinModal(false);
    await onSimulate('success');
  };

  const handleCardSubmit = async () => {
    setShowCardOtpModal(false);
    if (cardNumber.includes('0002')) {
      await onSimulate('fail');
    } else {
      await onSimulate('success');
    }
  };

  const copyOrderId = () => {
    navigator.clipboard.writeText(order.order.gatewayOrderId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in">
      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-ink-100">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-ink-100 bg-gradient-to-r from-brand-50/50 via-ink-50/30 to-white px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-500 text-white shadow-md shadow-brand-500/20">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display font-bold text-ink-900">Sandbox Payment Gateway</h3>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold tracking-wide text-emerald-800">
                  SIMULATOR
                </span>
              </div>
              <p className="text-xs text-ink-500">
                Repayment to <span className="font-semibold text-ink-700">{shopName ?? 'Merchant'}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="rounded-full p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Amount Banner */}
        <div className="flex items-center justify-between bg-ink-900 px-6 py-3.5 text-white">
          <div>
            <span className="text-xs text-ink-300">Total Payable</span>
            <div className="flex items-center gap-1.5">
              <Money paise={amountPaise} size="xl" className="!text-white" />
            </div>
          </div>
          <div className="text-right">
            <span className="text-[11px] text-ink-400">Gateway Order ID</span>
            <button
              onClick={copyOrderId}
              className="flex items-center gap-1 text-xs font-mono font-medium text-brand-300 hover:text-white"
            >
              <span>{order.order.gatewayOrderId}</span>
              {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
            </button>
          </div>
        </div>

        {/* Nav Tabs */}
        <div className="flex border-b border-ink-100 bg-ink-50/50 p-1">
          <button
            onClick={() => setTab('upi')}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition',
              tab === 'upi' ? 'bg-white text-brand-700 shadow-sm' : 'text-ink-500 hover:text-ink-800',
            )}
          >
            <Smartphone className="h-3.5 w-3.5" /> UPI Apps
          </button>
          <button
            onClick={() => setTab('card')}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition',
              tab === 'card' ? 'bg-white text-brand-700 shadow-sm' : 'text-ink-500 hover:text-ink-800',
            )}
          >
            <CreditCard className="h-3.5 w-3.5" /> Debit / Card
          </button>
          <button
            onClick={() => setTab('netbanking')}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition',
              tab === 'netbanking' ? 'bg-white text-brand-700 shadow-sm' : 'text-ink-500 hover:text-ink-800',
            )}
          >
            <Building2 className="h-3.5 w-3.5" /> Net Banking
          </button>
          <button
            onClick={() => setTab('dev')}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition',
              tab === 'dev' ? 'bg-white text-accent-700 shadow-sm' : 'text-ink-500 hover:text-ink-800',
            )}
          >
            <Zap className="h-3.5 w-3.5" /> Dev Tools
          </button>
        </div>

        {/* Tab Contents */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* UPI TAB */}
          {tab === 'upi' && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-ink-500">
                  Select Preferred UPI App
                </label>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {UPI_APPS.map((app) => (
                    <button
                      key={app.id}
                      onClick={() => {
                        setSelectedApp(app);
                        setUpiId(`rahulkumar@${app.handle}`);
                      }}
                      className={cn(
                        'flex flex-col items-center justify-center rounded-2xl border p-3 text-center transition',
                        selectedApp.id === app.id
                          ? 'border-brand-500 bg-brand-50/50 shadow-sm'
                          : 'border-ink-100 hover:border-ink-200 bg-white',
                      )}
                    >
                      <div className={cn('flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold', app.color)}>
                        {app.name.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="mt-1.5 text-xs font-semibold text-ink-800">{app.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Field label="UPI ID / VPA">
                  <Input
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    placeholder="user@upi"
                  />
                </Field>
                <div className="mt-1 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setUpiId(`rahul@${selectedApp.handle}`)}
                    className="text-xs font-semibold text-brand-600 hover:underline"
                  >
                    ⚡ Auto-fill Demo VPA
                  </button>
                </div>
              </div>

              <div className="rounded-2xl bg-emerald-50/60 p-3.5 text-xs text-emerald-800 ring-1 ring-emerald-200/60">
                <div className="flex items-start gap-2">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                  <div>
                    <span className="font-bold">Sandbox Simulated Gateway:</span> Clicking continue opens an authentic UPI MPIN prompt with realistic signature verification.
                  </div>
                </div>
              </div>

              <Button
                variant="primary"
                size="lg"
                fullWidth
                loading={isProcessing}
                onClick={() => {
                  setUpiPin('');
                  setShowUpiPinModal(true);
                }}
              >
                Pay <Money paise={amountPaise} size="md" className="!text-white" /> via {selectedApp.name}
              </Button>
            </div>
          )}

          {/* CARD TAB */}
          {tab === 'card' && (
            <div className="space-y-4">
              {/* Virtual Card Mockup */}
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-tr from-slate-900 via-indigo-950 to-slate-800 p-4 text-white shadow-lg">
                <div className="flex items-center justify-between">
                  <span className="font-display text-xs font-extrabold tracking-wider text-emerald-400">RUPAY / VISA</span>
                  <span className="text-[10px] font-mono tracking-widest text-slate-300">DEBIT CARD</span>
                </div>
                <div className="mt-4 flex h-6 w-8 items-center justify-center rounded bg-amber-300/80">
                  <div className="h-3 w-4 rounded-sm border border-amber-800/40" />
                </div>
                <div className="mt-3 font-mono text-sm tracking-widest text-slate-100">
                  {cardNumber || '•••• •••• •••• ••••'}
                </div>
                <div className="mt-3 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[9px] text-slate-400 block uppercase">Card Holder</span>
                    <span className="font-medium">{cardHolder || 'CARDHOLDER'}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 block uppercase">Expires</span>
                    <span className="font-medium">{cardExpiry || 'MM/YY'}</span>
                  </div>
                </div>
              </div>

              {/* Presets */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCardNumber('4111 1111 1111 1111');
                    setCardExpiry('12/28');
                    setCardCvv('786');
                  }}
                  className="flex-1 rounded-xl bg-ink-50 px-2 py-1.5 text-center text-xs font-semibold text-brand-700 hover:bg-brand-50"
                >
                  ⚡ Test Card (Success)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCardNumber('4000 0000 0000 0002');
                    setCardExpiry('06/25');
                    setCardCvv('000');
                  }}
                  className="flex-1 rounded-xl bg-ink-50 px-2 py-1.5 text-center text-xs font-semibold text-rose-600 hover:bg-rose-50"
                >
                  ⚠️ Test Card (Decline)
                </button>
              </div>

              {/* Form */}
              <div className="space-y-3">
                <Field label="Card Number">
                  <Input
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    placeholder="4111 1111 1111 1111"
                  />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Expiry Date">
                    <Input
                      value={cardExpiry}
                      onChange={(e) => setCardExpiry(e.target.value)}
                      placeholder="MM/YY"
                    />
                  </Field>
                  <Field label="CVV">
                    <Input
                      type="password"
                      maxLength={4}
                      value={cardCvv}
                      onChange={(e) => setCardCvv(e.target.value)}
                      placeholder="123"
                    />
                  </Field>
                </div>
              </div>

              <Button
                variant="primary"
                size="lg"
                fullWidth
                loading={isProcessing}
                onClick={() => {
                  setCardOtp('');
                  setShowCardOtpModal(true);
                }}
              >
                Proceed to 3D-Secure Bank OTP
              </Button>
            </div>
          )}

          {/* NETBANKING TAB */}
          {tab === 'netbanking' && (
            <div className="space-y-4">
              <label className="text-xs font-bold uppercase tracking-wider text-ink-500">
                Select Retail Bank
              </label>
              <div className="grid grid-cols-2 gap-2">
                {BANKS.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => setSelectedBank(b.id)}
                    className={cn(
                      'flex items-center gap-2.5 rounded-2xl border p-3 text-left transition',
                      selectedBank === b.id
                        ? 'border-brand-500 bg-brand-50/50 shadow-sm'
                        : 'border-ink-100 hover:border-ink-200 bg-white',
                    )}
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-ink-100 text-[10px] font-bold text-ink-700">
                      {b.code}
                    </div>
                    <span className="text-xs font-semibold text-ink-800 line-clamp-1">{b.name}</span>
                  </button>
                ))}
              </div>

              <div className="rounded-2xl bg-sky-50/70 p-3.5 text-xs text-sky-800 ring-1 ring-sky-200/60">
                <p className="font-semibold">Simulated Netbanking Gateway:</p>
                <p className="mt-0.5 text-sky-700">
                  Clicking Authorize simulates direct instant bank verification via the server webhook.
                </p>
              </div>

              <Button
                variant="primary"
                size="lg"
                fullWidth
                loading={isProcessing}
                onClick={() => onSimulate('success')}
              >
                Authorize & Pay <Money paise={amountPaise} size="md" className="!text-white" />
              </Button>
            </div>
          )}

          {/* DEV TOOLS / SANDBOX CONTROLS TAB */}
          {tab === 'dev' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-ink-100 bg-ink-50 p-4 space-y-2.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-ink-500">Provider:</span>
                  <span className="font-mono font-bold text-ink-800">{order.order.provider}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-500">Gateway Order ID:</span>
                  <span className="font-mono font-bold text-ink-800">{order.order.gatewayOrderId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-500">Webhook Verification:</span>
                  <span className="font-semibold text-emerald-700">HMAC-SHA256 (Enforced)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-500">Idempotency Guard:</span>
                  <span className="font-semibold text-emerald-700">Active (Event ID tracking)</span>
                </div>
              </div>

              <div className="space-y-2">
                <Button
                  variant="primary"
                  fullWidth
                  loading={isProcessing}
                  onClick={() => onSimulate('success')}
                >
                  <CheckCircle2 className="h-4 w-4" /> Force Immediate Webhook SUCCESS
                </Button>

                <Button
                  variant="outline"
                  fullWidth
                  className="!text-rose-600 hover:bg-rose-50"
                  loading={isProcessing}
                  onClick={() => onSimulate('fail')}
                >
                  <XCircle className="h-4 w-4" /> Force Immediate Webhook FAILURE
                </Button>

                <Button
                  variant="ghost"
                  fullWidth
                  className="text-xs text-ink-500"
                  onClick={async () => {
                    // Replay identical success simulation to prove idempotency
                    await onSimulate('success');
                  }}
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Test Replay Webhook (Idempotency Proof)
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-ink-100 bg-ink-50/40 px-5 py-2.5 text-center text-[11px] text-ink-400">
          Digital Udhar · Pluggable Payment Gateway Simulation Mode
        </div>
      </div>

      {/* Realistic UPI PIN Pad Modal */}
      {showUpiPinModal && (
        <div className="fixed inset-0 z-60 flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-sm rounded-t-3xl sm:rounded-3xl bg-white p-6 shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between border-b border-ink-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  <KeyRound className="h-4 w-4" />
                </div>
                <h4 className="font-display text-sm font-bold text-ink-900">ENTER 4-DIGIT UPI PIN</h4>
              </div>
              <button
                onClick={() => setShowUpiPinModal(false)}
                className="text-ink-400 hover:text-ink-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="my-4 text-center">
              <p className="text-xs text-ink-500">Paying {shopName ?? 'Merchant'}</p>
              <div className="mt-1 flex justify-center">
                <Money paise={amountPaise} size="xl" tone="accent" />
              </div>
              <p className="mt-1 text-[11px] text-ink-400">From account {upiId}</p>

              {/* PIN Dots */}
              <div className="mt-5 flex justify-center gap-4">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={cn(
                      'h-3.5 w-3.5 rounded-full border-2 transition-all',
                      i < upiPin.length
                        ? 'border-brand-600 bg-brand-600 scale-110'
                        : 'border-ink-300 bg-transparent',
                    )}
                  />
                ))}
              </div>
            </div>

            {/* Keypad */}
            <div className="mt-6 grid grid-cols-3 gap-2">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  onClick={() => handleKeypadPress(digit)}
                  className="flex h-12 items-center justify-center rounded-2xl bg-ink-50 font-display text-lg font-bold text-ink-800 active:bg-brand-100 transition"
                >
                  {digit}
                </button>
              ))}
              <button
                onClick={handleKeypadBackspace}
                className="flex h-12 items-center justify-center rounded-2xl bg-ink-100 text-ink-600 active:bg-ink-200 transition"
              >
                <Delete className="h-5 w-5" />
              </button>
              <button
                onClick={() => handleKeypadPress('0')}
                className="flex h-12 items-center justify-center rounded-2xl bg-ink-50 font-display text-lg font-bold text-ink-800 active:bg-brand-100 transition"
              >
                0
              </button>
              <button
                disabled={upiPin.length !== 4}
                onClick={handleUpiSubmit}
                className="flex h-12 items-center justify-center rounded-2xl bg-brand-600 font-bold text-white shadow-md active:bg-brand-700 disabled:opacity-40 transition"
              >
                <Check className="h-6 w-6" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setUpiPin('1234');
                setTimeout(() => handleUpiSubmit(), 300);
              }}
              className="mt-4 w-full text-center text-xs font-semibold text-brand-600 hover:underline"
            >
              ⚡ 1-Tap Auto-Authorize (PIN: 1234)
            </button>
          </div>
        </div>
      )}

      {/* 3D-Secure Bank OTP Modal */}
      {showCardOtpModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl animate-scale-in space-y-4">
            <div className="flex items-center justify-between border-b border-ink-100 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-indigo-600" />
                <h4 className="font-display text-sm font-bold text-ink-900">3D-SECURE VERIFICATION</h4>
              </div>
              <button
                onClick={() => setShowCardOtpModal(false)}
                className="text-ink-400 hover:text-ink-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-2xl bg-indigo-50/70 p-3 text-xs text-indigo-900 ring-1 ring-indigo-200/70">
              <p className="font-semibold">Simulated Bank SMS:</p>
              <p className="mt-0.5 text-indigo-700">
                OTP for ₹{(amountPaise / 100).toFixed(2)} at JamaBaaki is <span className="font-bold font-mono">123456</span>. Do not share this with anyone.
              </p>
            </div>

            <Field label="One Time Password (OTP)">
              <Input
                autoFocus
                maxLength={6}
                value={cardOtp}
                onChange={(e) => setCardOtp(e.target.value)}
                placeholder="123456"
                className="text-center font-mono text-xl tracking-widest"
              />
            </Field>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setCardOtp('123456')}
              >
                Auto-fill
              </Button>
              <Button
                variant="primary"
                className="flex-1"
                disabled={cardOtp.length < 4}
                onClick={handleCardSubmit}
              >
                Authorize
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
