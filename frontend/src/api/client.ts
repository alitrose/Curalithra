import type { ApiError } from '../types/api';

const TOKEN_STORAGE_KEY = 'curalithra.accessToken';
export const AUTH_EXPIRED_EVENT = 'curalithra:auth-expired';

export class ApiRequestError extends Error {
  status: number;
  fieldErrors: Record<string, string>;

  constructor(status: number, message: string, fieldErrors: Record<string, string> = {}) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

export function getApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL as string | undefined;
  return configured && configured.trim().length > 0
    ? configured.trim().replace(/\/+$/, '')
    : '/api';
}

export function getStoredToken(): string | null {
  return sessionStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setStoredToken(token: string | null): void {
  if (token) {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

function shouldBroadcastUnauthorized(path: string, hadToken: boolean): boolean {
  if (!hadToken) return false;
  return !path.startsWith('/auth/login') && !path.startsWith('/auth/setup');
}

async function parseErrorResponse(res: Response): Promise<ApiRequestError> {
  let payload: Partial<ApiError> = {};
  try {
    payload = (await res.json()) as Partial<ApiError>;
  } catch {
    // ignore non-JSON body
  }
  return new ApiRequestError(
    res.status,
    payload.message || `Request failed with HTTP ${res.status}`,
    payload.fieldErrors || {}
  );
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let res: Response;
  try {
    res = await fetch(`${getApiBaseUrl()}${path}`, {
      ...options,
      headers,
    });
  } catch {
    throw new ApiRequestError(0, 'Unable to reach CURALITHRA API server. Check network or API URL.');
  }

  if (!res.ok) {
    const err = await parseErrorResponse(res);
    if (res.status === 401 && shouldBroadcastUnauthorized(path, Boolean(token))) {
      setStoredToken(null);
      window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT, { detail: err.message }));
    }
    throw err;
  }

  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

export async function apiDownloadBlob(path: string, fallbackFilename: string): Promise<void> {
  const token = getStoredToken();
  const headers = new Headers();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let res: Response;
  try {
    res = await fetch(`${getApiBaseUrl()}${path}`, { headers });
  } catch {
    throw new ApiRequestError(0, 'Unable to download file from CURALITHRA API.');
  }

  if (!res.ok) {
    const err = await parseErrorResponse(res);
    if (res.status === 401 && token) {
      setStoredToken(null);
      window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT, { detail: err.message }));
    }
    throw err;
  }

  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename\*?=(?:UTF-8''|")?([^\";]+)/i);
  const filename = match ? decodeURIComponent(match[1].replace(/"/g, '').trim()) : fallbackFilename;

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function buildQueryString(params: Record<string, string | number | boolean | null | undefined>): string {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      sp.set(key, String(value));
    }
  });
  const qs = sp.toString();
  return qs ? `?${qs}` : '';
}
