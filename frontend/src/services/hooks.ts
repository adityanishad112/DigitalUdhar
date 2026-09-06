import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  AdminMerchant,
  AdminOverview,
  AdminUser,
  AuditLog,
  AuthResult,
  CreateOrderResult,
  CustomerUdhaar,
  DemoAccountsResponse,
  Dispute,
  LedgerTxn,
  Me,
  Merchant,
  MerchantCustomerRow,
  MerchantReport,
  MerchantUdhaar,
  Notification,
  PromiseToPay,
  Qr,
  QrResolveResult,
  Role,
  SendOtpResult,
  SimulateResult,
  Udhaar,
  UdhaarDetail,
  VerifyPaymentResult,
} from '@/lib/types';

/** Centralised query keys so mutations can invalidate precisely. */
export const qk = {
  me: ['me'] as const,
  demoAccounts: ['demo', 'accounts'] as const,
  udhaarList: ['udhaar', 'list'] as const,
  udhaar: (id: string) => ['udhaar', id] as const,
  qrResolve: (token: string) => ['qr', 'resolve', token] as const,
  qrList: ['qr', 'list'] as const,
  shop: ['merchant', 'me'] as const,
  customers: ['merchant', 'customers'] as const,
  report: ['merchant', 'report'] as const,
  activity: ['merchant', 'activity'] as const,
  notifications: (unread?: boolean) => ['notifications', { unread: !!unread }] as const,
  unreadCount: ['notifications', 'unread-count'] as const,
  receipts: (udhaarId: string) => ['receipts', udhaarId] as const,
  disputes: ['disputes'] as const,
  dispute: (id: string) => ['dispute', id] as const,
  adminOverview: ['admin', 'overview'] as const,
  adminUsers: (f?: Record<string, string>) => ['admin', 'users', f ?? {}] as const,
  adminMerchants: (f?: Record<string, string>) => ['admin', 'merchants', f ?? {}] as const,
  auditLogs: ['admin', 'audit-logs'] as const,
};

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
export function useSendOtp() {
  return useMutation({
    mutationFn: (input: { mobile: string; role: Role }) =>
      api.post<SendOtpResult>('/auth/send-otp', input),
  });
}

export function useVerifyOtp() {
  return useMutation({
    mutationFn: (input: { mobile: string; role: Role; code: string; name?: string }) =>
      api.post<AuthResult>('/auth/verify-otp', input),
  });
}

export function useMe(enabled = true) {
  return useQuery({
    queryKey: qk.me,
    queryFn: () => api.get<Me>('/auth/me'),
    enabled,
    staleTime: 60_000,
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Record<string, unknown>) => api.patch<Me>('/auth/profile', patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.me }),
  });
}

// ---------------------------------------------------------------------------
// QR
// ---------------------------------------------------------------------------
export function useResolveQr(token: string | null) {
  return useQuery({
    queryKey: qk.qrResolve(token ?? ''),
    queryFn: () => api.get<QrResolveResult>(`/qr/${encodeURIComponent(token!)}`),
    enabled: !!token,
    retry: false,
  });
}

export function useMyQrs() {
  return useQuery({ queryKey: qk.qrList, queryFn: () => api.get<Qr[]>('/qr') });
}

export function useGenerateQr() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (label?: string) => api.post<Qr>('/qr/generate', { label }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.qrList }),
  });
}

export function useRevokeQr() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => api.post<Qr>(`/qr/${encodeURIComponent(token)}/revoke`),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.qrList }),
  });
}

// ---------------------------------------------------------------------------
// Merchant profile / customers / reports
// ---------------------------------------------------------------------------
export function useMyShop(enabled = true) {
  return useQuery({
    queryKey: qk.shop,
    queryFn: () => api.get<Merchant>('/merchants/me'),
    enabled,
    retry: false,
  });
}

export function useRegisterShop() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) => api.post<Merchant>('/merchants', input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.shop });
      qc.invalidateQueries({ queryKey: qk.me });
    },
  });
}

export function useUpdateShop() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Record<string, unknown>) => api.patch<Merchant>('/merchants/me', patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.shop }),
  });
}

export function useMerchantCustomers() {
  return useQuery({
    queryKey: qk.customers,
    queryFn: () => api.get<MerchantCustomerRow[]>('/merchants/me/customers'),
  });
}

export function useMerchantReport() {
  return useQuery({ queryKey: qk.report, queryFn: () => api.get<MerchantReport>('/reports') });
}

export function useMerchantActivity() {
  return useQuery({ queryKey: qk.activity, queryFn: () => api.get<LedgerTxn[]>('/reports/activity') });
}

// ---------------------------------------------------------------------------
// Udhaar
// ---------------------------------------------------------------------------
/** Both customer and merchant hit GET /udhaar; the server returns the right rows. */
export function useUdhaarList<T = CustomerUdhaar[] | MerchantUdhaar[]>(
  options?: Partial<UseQueryOptions<T>>,
) {
  return useQuery({
    queryKey: qk.udhaarList,
    queryFn: () => api.get<T>('/udhaar'),
    ...options,
  });
}

export function useUdhaarDetail(id: string | null) {
  return useQuery({
    queryKey: qk.udhaar(id ?? ''),
    queryFn: () => api.get<UdhaarDetail>(`/udhaar/${id}`),
    enabled: !!id,
  });
}

export function useRequestUdhaar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      merchantId: string;
      principalPaise: number;
      items?: { name: string; qty?: number; pricePaise?: number }[];
      note?: string;
      dueDate?: string;
    }) => api.post<Udhaar>('/udhaar/request', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.udhaarList }),
  });
}

function invalidateUdhaar(qc: ReturnType<typeof useQueryClient>, id: string) {
  qc.invalidateQueries({ queryKey: qk.udhaarList });
  qc.invalidateQueries({ queryKey: qk.udhaar(id) });
  qc.invalidateQueries({ queryKey: qk.customers });
  qc.invalidateQueries({ queryKey: qk.report });
}

export function useAcceptUdhaar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/udhaar/${id}/accept`),
    onSuccess: (_d, id) => invalidateUdhaar(qc, id),
  });
}

export function useRejectUdhaar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      api.post(`/udhaar/${id}/reject`, { reason }),
    onSuccess: (_d, v) => invalidateUdhaar(qc, v.id),
  });
}

export function usePromiseToPay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      promisedDate,
      amountPaise,
      note,
    }: {
      id: string;
      promisedDate: string;
      amountPaise?: number;
      note?: string;
    }) => api.post<PromiseToPay>(`/udhaar/${id}/promise-to-pay`, { promisedDate, amountPaise, note }),
    onSuccess: (_d, v) => invalidateUdhaar(qc, v.id),
  });
}

export function useCashRepayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, amountPaise }: { id: string; amountPaise: number }) =>
      api.post(`/udhaar/${id}/cash-repayment`, { amountPaise }),
    onSuccess: (_d, v) => invalidateUdhaar(qc, v.id),
  });
}

// ---------------------------------------------------------------------------
// Payments (digital repayment via the mock sandbox)
// ---------------------------------------------------------------------------
export function useCreateOrder() {
  return useMutation({
    mutationFn: (input: { udhaarId: string; amountPaise: number; method?: string }) =>
      api.post<CreateOrderResult>('/payments/create-order', input),
  });
}

export function useSimulatePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { gatewayOrderId: string; outcome: 'success' | 'fail' }) =>
      api.post<SimulateResult>('/payments/mock/pay', input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.udhaarList });
      qc.invalidateQueries({ queryKey: ['udhaar'] });
      qc.invalidateQueries({ queryKey: qk.unreadCount });
    },
  });
}

export function useVerifyPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { gatewayOrderId: string; gatewayPaymentId: string; signature: string }) =>
      api.post<VerifyPaymentResult>('/payments/verify', input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.udhaarList });
      qc.invalidateQueries({ queryKey: ['udhaar'] });
      qc.invalidateQueries({ queryKey: qk.unreadCount });
      qc.invalidateQueries({ queryKey: qk.customers });
    },
  });
}

export function useRefund() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ paymentId, amountPaise, reason }: { paymentId: string; amountPaise: number; reason?: string }) =>
      api.post(`/payments/${paymentId}/refund`, { amountPaise, reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['udhaar'] });
      qc.invalidateQueries({ queryKey: qk.customers });
      qc.invalidateQueries({ queryKey: qk.report });
    },
  });
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------
export function useNotifications(unread = false) {
  return useQuery({
    queryKey: qk.notifications(unread),
    queryFn: () => api.get<Notification[]>('/notifications', unread ? { unread: true } : undefined),
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: qk.unreadCount,
    queryFn: () => api.get<{ count: number }>('/notifications/unread-count'),
    refetchInterval: 30_000,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/notifications/${id}/read`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/notifications/read-all'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

// ---------------------------------------------------------------------------
// Disputes / adjustments / identity
// ---------------------------------------------------------------------------
export function useDisputes() {
  return useQuery({ queryKey: qk.disputes, queryFn: () => api.get<Dispute[]>('/disputes') });
}

export function useRaiseDispute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { udhaarId: string; category: string; description?: string; amountClaimedPaise?: number }) =>
      api.post<Dispute>('/disputes', input),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: qk.disputes });
      qc.invalidateQueries({ queryKey: qk.udhaar(v.udhaarId) });
    },
  });
}

export function useCreateAdjustment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { udhaarId: string; amountPaise: number; reason: string }) =>
      api.post('/adjustments', input),
    onSuccess: (_d, v) => invalidateUdhaar(qc, v.udhaarId),
  });
}

export function useSubmitIdentity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { method: string; value: string; consent: boolean }) =>
      api.post('/identity/submit', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.me }),
  });
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------
export function useAdminOverview() {
  return useQuery({ queryKey: qk.adminOverview, queryFn: () => api.get<AdminOverview>('/admin/overview') });
}

export function useAdminUsers(filters?: Record<string, string>) {
  return useQuery({
    queryKey: qk.adminUsers(filters),
    queryFn: () => api.get<AdminUser[]>('/admin/users', filters),
  });
}

export function useAdminMerchants(filters?: Record<string, string>) {
  return useQuery({
    queryKey: qk.adminMerchants(filters),
    queryFn: () => api.get<AdminMerchant[]>('/admin/merchants', filters),
  });
}

export function useAuditLogs() {
  return useQuery({ queryKey: qk.auditLogs, queryFn: () => api.get<AuditLog[]>('/admin/audit-logs') });
}

export function useSetUserStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: string; reason?: string }) =>
      api.post(`/admin/users/${id}/status`, { status, reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      qc.invalidateQueries({ queryKey: qk.adminOverview });
    },
  });
}

export function useSetMerchantStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: string; reason?: string }) =>
      api.post(`/admin/merchants/${id}/status`, { status, reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'merchants'] });
      qc.invalidateQueries({ queryKey: qk.adminOverview });
    },
  });
}

// ---------------------------------------------------------------------------
// Demo Suite (Accounts, 1-Click Fast Switching, Reset, Sample Scenarios)
// ---------------------------------------------------------------------------
export function useDemoAccounts() {
  return useQuery({
    queryKey: qk.demoAccounts,
    queryFn: () => api.get<DemoAccountsResponse>('/demo/accounts'),
    staleTime: 60_000,
  });
}

export function useDemoQuickLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { mobile: string; role: Role }) =>
      api.post<AuthResult>('/demo/quick-login', input),
    onSuccess: () => {
      qc.clear();
    },
  });
}

export function useResetDemoData() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ success: boolean; message: string }>('/demo/reset'),
    onSuccess: () => {
      qc.clear();
    },
  });
}

export function useSeedDemoScenario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (scenario: 'new_request' | 'overdue_request') =>
      api.post<{ success: boolean; scenario: string; message: string }>('/demo/seed-scenario', { scenario }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.udhaarList });
      qc.invalidateQueries({ queryKey: ['udhaar'] });
      qc.invalidateQueries({ queryKey: qk.report });
      qc.invalidateQueries({ queryKey: qk.customers });
    },
  });
}

// Re-export a couple of types callers commonly need alongside the hooks.
export type { Udhaar };

