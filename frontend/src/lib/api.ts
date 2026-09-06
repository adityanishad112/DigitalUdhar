import axios, { AxiosError } from 'axios';

/**
 * Single axios instance for the whole app.
 *
 * - Base URL is `/api`; Vite proxies that to the backend on :4000 in dev.
 * - The JWT is held in a module variable (set by the auth store) so we avoid a
 *   circular import between the store and this client.
 * - Every successful response is unwrapped from the `{ ok, data }` envelope, so
 *   callers receive `data` directly.
 * - Errors are normalised to `ApiError` carrying the backend's code/message.
 */

let authToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
}

export function setUnauthorizedHandler(fn: () => void): void {
  onUnauthorized = fn;
}

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const http = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 20000,
});

http.interceptors.request.use((config) => {
  if (authToken) {
    config.headers.set('Authorization', `Bearer ${authToken}`);
  }
  return config;
});

http.interceptors.response.use(
  (response) => {
    // Unwrap { ok: true, data } → data. Tolerate bare payloads too.
    const body = response.data;
    if (body && typeof body === 'object' && 'ok' in body) {
      return { ...response, data: (body as { data: unknown }).data };
    }
    return response;
  },
  (error: AxiosError<{ ok?: boolean; error?: { code?: string; message?: string; details?: unknown } }>) => {
    const status = error.response?.status ?? 0;
    const payload = error.response?.data?.error;
    const code = payload?.code ?? (status === 0 ? 'NETWORK' : 'ERROR');

    let message = payload?.message;
    if (payload?.details && Array.isArray(payload.details) && payload.details.length > 0) {
      const detailsMsg = payload.details
        .map((d: { message?: string }) => d.message)
        .filter(Boolean)
        .join(', ');
      if (detailsMsg) message = detailsMsg;
    }
    if (!message) {
      message =
        status === 0
          ? 'Cannot reach the server. Is the backend running?'
          : error.message || 'Something went wrong';
    }

    if (status === 401 && onUnauthorized) {
      onUnauthorized();
    }
    return Promise.reject(new ApiError(status, code, message, payload?.details));
  },
);

/** Thin typed helpers so callers don't repeat `.then(r => r.data)`. */
export const api = {
  get: <T>(url: string, params?: Record<string, unknown>) =>
    http.get<T>(url, { params }).then((r) => r.data as T),
  post: <T>(url: string, body?: unknown) => http.post<T>(url, body).then((r) => r.data as T),
  patch: <T>(url: string, body?: unknown) => http.patch<T>(url, body).then((r) => r.data as T),
  del: <T>(url: string) => http.delete<T>(url).then((r) => r.data as T),
};
