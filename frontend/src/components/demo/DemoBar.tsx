import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Layers,
  PlayCircle,
  QrCode,
  RefreshCw,
  RotateCcw,
  Shield,
  Sparkles,
  Store,
  UserCheck,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { useAuth } from '@/store/auth';
import { useUi } from '@/store/ui';
import {
  useDemoAccounts,
  useDemoQuickLogin,
  useResetDemoData,
  useSeedDemoScenario,
} from '@/services/hooks';
import type { Role } from '@/lib/types';
import { cn } from '@/lib/cn';

const WORKFLOW_STEPS = [
  {
    step: 1,
    title: 'Scan & Request Udhaar',
    actor: 'Customer (Rahul)',
    desc: 'Customer scans shop QR and submits an itemized udhaar request.',
    targetPath: '/app/scan',
    switchRole: { mobile: '8000000001', role: 'CUSTOMER' as Role },
  },
  {
    step: 2,
    title: 'Review & Accept Request',
    actor: 'Merchant (Rajesh)',
    desc: 'Merchant reviews the request on the counter and accepts it into ledger.',
    targetPath: '/merchant/requests',
    switchRole: { mobile: '9000000001', role: 'MERCHANT' as Role },
  },
  {
    step: 3,
    title: 'Repay via Sandbox Gateway',
    actor: 'Customer (Rahul)',
    desc: 'Customer makes a partial/full repayment using UPI or Card simulator.',
    targetPath: '/app/khatas',
    switchRole: { mobile: '8000000001', role: 'CUSTOMER' as Role },
  },
  {
    step: 4,
    title: 'Immutable Ledger & Receipt',
    actor: 'Any / Merchant',
    desc: 'Audit transaction history and download cryptographically verified receipt.',
    targetPath: '/merchant',
    switchRole: { mobile: '9000000001', role: 'MERCHANT' as Role },
  },
  {
    step: 5,
    title: 'Admin Governance & Audit',
    actor: 'Platform Admin',
    desc: 'Inspect financial volumes, dispute queues, user freeze actions, and audit logs.',
    targetPath: '/admin',
    switchRole: { mobile: '9999900000', role: 'ADMIN' as Role },
  },
];

export function DemoBar() {
  const navigate = useNavigate();
  const currentUser = useAuth((s) => s.user);
  const setSession = useAuth((s) => s.setSession);
  const pushToast = useUi((s) => s.pushToast);

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'personas' | 'guide' | 'scenarios'>('personas');

  const { data: demoData, isLoading: accountsLoading } = useDemoAccounts();
  const quickLogin = useDemoQuickLogin();
  const resetData = useResetDemoData();
  const seedScenario = useSeedDemoScenario();

  const handleSwitchPersona = async (mobile: string, role: Role, redirectPath?: string) => {
    try {
      const res = await quickLogin.mutateAsync({ mobile, role });
      setSession(res.token, res.user);
      pushToast({
        kind: 'success',
        message: `Switched to ${res.user.name ?? role} (${role})`,
      });

      if (redirectPath) {
        navigate(redirectPath);
      } else if (role === 'CUSTOMER') {
        navigate('/app');
      } else if (role === 'MERCHANT' || role === 'STAFF') {
        navigate('/merchant');
      } else if (role === 'ADMIN') {
        navigate('/admin');
      }
      setIsOpen(false);
    } catch {
      pushToast({ kind: 'error', message: 'Failed to switch demo persona' });
    }
  };

  const handleReset = async () => {
    if (!confirm('Reset all demo data back to default initial state?')) return;
    try {
      await resetData.mutateAsync();
      pushToast({ kind: 'success', message: 'Demo data has been reset to default state' });
      // Re-login as customer to have clean state
      await handleSwitchPersona('8000000001', 'CUSTOMER', '/app');
    } catch {
      pushToast({ kind: 'error', message: 'Failed to reset demo data' });
    }
  };

  const handleInjectScenario = async (scenario: 'new_request' | 'overdue_request') => {
    try {
      const res = await seedScenario.mutateAsync(scenario);
      pushToast({ kind: 'success', message: res.message });
      // Switch to Merchant to review
      await handleSwitchPersona('9000000001', 'MERCHANT', '/merchant/requests');
    } catch {
      pushToast({ kind: 'error', message: 'Failed to inject scenario' });
    }
  };

  const currentRoleName = currentUser
    ? `${currentUser.name ?? currentUser.mobile} · ${currentUser.role}`
    : 'Guest';

  return (
    <>
      {/* Floating Demo Pill */}
      <aside aria-label="Demo Bar" className="fixed bottom-20 right-4 z-40 flex items-center gap-1.5 rounded-full bg-ink-900/95 p-1.5 pl-3 text-white shadow-xl shadow-ink-950/20 backdrop-blur-md ring-1 ring-white/10 transition-all hover:ring-brand-400">
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 text-left"
        >
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-500 text-white">
            <Zap className="h-3.5 w-3.5" />
          </div>
          <div className="hidden sm:block">
            <span className="block text-[10px] font-extrabold uppercase tracking-wider text-brand-300">
              Demo Mode
            </span>
            <span className="block max-w-[140px] truncate text-xs font-semibold text-ink-100">
              {currentRoleName}
            </span>
          </div>
        </button>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsOpen(true)}
            className="flex h-7 items-center gap-1 rounded-full bg-white/10 px-2.5 text-xs font-bold text-ink-100 hover:bg-white/20 transition"
          >
            Switch <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={handleReset}
            disabled={resetData.isPending}
            title="Reset Demo Data"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-white/5 text-ink-300 hover:bg-rose-500/20 hover:text-rose-300 transition"
          >
            <RotateCcw className={cn('h-3.5 w-3.5', resetData.isPending && 'animate-spin')} />
          </button>
        </div>
      </aside>

      {/* Expanded Demo Control Center Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 backdrop-blur-sm animate-fade-in">
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl ring-1 ring-ink-100 animate-scale-in">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-ink-100 bg-gradient-to-r from-brand-50 via-ink-50/50 to-white px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-brand-500 text-white shadow-md shadow-brand-500/20">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display text-sm font-bold text-ink-900">Demo Command Center</h3>
                  <p className="text-xs text-ink-500">
                    Active: <span className="font-semibold text-brand-700">{currentRoleName}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-full p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-ink-100 bg-ink-50/50 p-1">
              <button
                onClick={() => setActiveTab('personas')}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition',
                  activeTab === 'personas' ? 'bg-white text-brand-700 shadow-sm' : 'text-ink-500 hover:text-ink-800',
                )}
              >
                <Users className="h-3.5 w-3.5" /> Personas
              </button>
              <button
                onClick={() => setActiveTab('guide')}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition',
                  activeTab === 'guide' ? 'bg-white text-brand-700 shadow-sm' : 'text-ink-500 hover:text-ink-800',
                )}
              >
                <BookOpen className="h-3.5 w-3.5" /> 5-Step Tour
              </button>
              <button
                onClick={() => setActiveTab('scenarios')}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition',
                  activeTab === 'scenarios' ? 'bg-white text-brand-700 shadow-sm' : 'text-ink-500 hover:text-ink-800',
                )}
              >
                <Layers className="h-3.5 w-3.5" /> Test Scenarios
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* PERSONAS TAB */}
              {activeTab === 'personas' && (
                <div className="space-y-3">
                  <p className="text-xs text-ink-500">
                    Switch roles instantly in 1-tap without entering OTPs or logging out:
                  </p>

                  <div className="space-y-2">
                    {demoData?.accounts.map((acc) => {
                      const isActive = currentUser?.mobile === acc.mobile && currentUser?.role === acc.role;
                      return (
                        <div
                          key={`${acc.role}-${acc.mobile}`}
                          className={cn(
                            'flex items-center justify-between rounded-2xl border p-3.5 transition',
                            isActive
                              ? 'border-brand-500 bg-brand-50/40 ring-1 ring-brand-200'
                              : 'border-ink-100 hover:border-ink-200 bg-white',
                          )}
                        >
                          <div className="min-w-0 flex-1 pr-3">
                            <div className="flex items-center gap-2">
                              <span className="font-display text-sm font-bold text-ink-900">
                                {acc.name}
                              </span>
                              <span
                                className={cn(
                                  'rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase',
                                  acc.role === 'CUSTOMER' && 'bg-blue-100 text-blue-800',
                                  acc.role === 'MERCHANT' && 'bg-emerald-100 text-emerald-800',
                                  acc.role === 'ADMIN' && 'bg-purple-100 text-purple-800',
                                )}
                              >
                                {acc.badge}
                              </span>
                            </div>
                            <p className="mt-0.5 text-xs text-ink-500 line-clamp-1">{acc.description}</p>
                            <div className="mt-1 flex items-center gap-2 text-[11px] font-mono text-ink-400">
                              <span>Mobile: {acc.mobile}</span>
                              {acc.qrToken && (
                                <>
                                  <span>·</span>
                                  <span className="text-brand-600 font-sans">Counter QR Available</span>
                                </>
                              )}
                            </div>
                          </div>

                          <button
                            disabled={isActive || quickLogin.isPending}
                            onClick={() => handleSwitchPersona(acc.mobile, acc.role)}
                            className={cn(
                              'flex h-9 items-center gap-1 rounded-xl px-3 text-xs font-bold transition shrink-0',
                              isActive
                                ? 'bg-emerald-100 text-emerald-800 cursor-default'
                                : 'bg-ink-900 text-white hover:bg-brand-600 active:scale-95',
                            )}
                          >
                            {isActive ? (
                              <>
                                <CheckCircle2 className="h-3.5 w-3.5" /> Active
                              </>
                            ) : (
                              <>
                                Switch <ArrowRight className="h-3 w-3" />
                              </>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 5-STEP TOUR TAB */}
              {activeTab === 'guide' && (
                <div className="space-y-3">
                  <p className="text-xs text-ink-500">
                    Follow the core digital credit lifecycle end-to-end:
                  </p>

                  <div className="space-y-2.5">
                    {WORKFLOW_STEPS.map((step) => (
                      <div
                        key={step.step}
                        className="flex items-start gap-3 rounded-2xl border border-ink-100 bg-white p-3.5 transition hover:border-brand-200"
                      >
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                          {step.step}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <h4 className="font-display text-xs font-bold text-ink-900">{step.title}</h4>
                            <span className="text-[10px] font-semibold text-brand-600">{step.actor}</span>
                          </div>
                          <p className="mt-0.5 text-xs text-ink-500">{step.desc}</p>
                          <button
                            onClick={() =>
                              handleSwitchPersona(
                                step.switchRole.mobile,
                                step.switchRole.role,
                                step.targetPath,
                              )
                            }
                            className="mt-2 flex items-center gap-1 text-xs font-bold text-brand-600 hover:text-brand-800 transition"
                          >
                            Run this step <ArrowRight className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SCENARIOS TAB */}
              {activeTab === 'scenarios' && (
                <div className="space-y-3">
                  <p className="text-xs text-ink-500">
                    Instantly inject realistic financial scenarios for live testing and presentations:
                  </p>

                  <div className="space-y-2">
                    <div className="rounded-2xl border border-ink-100 bg-white p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-display text-xs font-bold text-ink-900">
                            Pending Udhaar Request (₹450)
                          </h4>
                          <p className="mt-0.5 text-xs text-ink-500">
                            Injects a pending request from Rahul to Sharma Store waiting for counter acceptance.
                          </p>
                        </div>
                        <button
                          disabled={seedScenario.isPending}
                          onClick={() => handleInjectScenario('new_request')}
                          className="flex items-center gap-1 rounded-xl bg-brand-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-700 transition shrink-0"
                        >
                          <PlayCircle className="h-3.5 w-3.5" /> Inject & View
                        </button>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-ink-100 bg-white p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-display text-xs font-bold text-ink-900">
                            Overdue Khata Scenario (₹650)
                          </h4>
                          <p className="mt-0.5 text-xs text-ink-500">
                            Injects an overdue balance due 5 days ago to trigger automated collection reminders.
                          </p>
                        </div>
                        <button
                          disabled={seedScenario.isPending}
                          onClick={() => handleInjectScenario('overdue_request')}
                          className="flex items-center gap-1 rounded-xl bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700 transition shrink-0"
                        >
                          <PlayCircle className="h-3.5 w-3.5" /> Inject & View
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-ink-100 bg-ink-50/50 px-5 py-3">
              <button
                onClick={handleReset}
                disabled={resetData.isPending}
                className="flex items-center gap-1.5 text-xs font-bold text-rose-600 hover:text-rose-800 transition"
              >
                <RotateCcw className={cn('h-3.5 w-3.5', resetData.isPending && 'animate-spin')} />
                Reset Demo Data
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-xl bg-ink-200 px-3 py-1.5 text-xs font-bold text-ink-700 hover:bg-ink-300 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
