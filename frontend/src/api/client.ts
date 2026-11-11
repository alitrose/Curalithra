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

function normalizeConfiguredBaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      if (parsed.pathname === '' || parsed.pathname === '/') {
        return `${trimmed}/api`;
      }
    } catch {
      // keep trimmed
    }
  }
  return trimmed;
}

function isLocalHostname(): boolean {
  if (typeof window === 'undefined') return true;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
}

export function isApiConfigured(): boolean {
  const configured = (import.meta.env.VITE_API_BASE_URL as string | undefined) || '';
  if (normalizeConfiguredBaseUrl(configured).length > 0) {
    return true;
  }
  return Boolean(import.meta.env.DEV) || import.meta.env.MODE === 'test' || isLocalHostname();
}

export function getApiBaseUrl(): string {
  const configured = (import.meta.env.VITE_API_BASE_URL as string | undefined) || '';
  const normalized = normalizeConfiguredBaseUrl(configured);
  if (normalized.length > 0) {
    return normalized;
  }
  if (Boolean(import.meta.env.DEV) || import.meta.env.MODE === 'test' || isLocalHostname()) {
    return '/api';
  }
  return '';
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
  return (
    !path.startsWith('/auth/login') &&
    !path.startsWith('/auth/setup') &&
    !path.startsWith('/auth/demo-')
  );
}

async function parseErrorResponse(res: Response): Promise<ApiRequestError> {
  let payload: Partial<ApiError> = {};
  try {
    payload = (await res.json()) as Partial<ApiError>;
  } catch {
    // ignore non-JSON body
  }

  let fallbackMessage = `Request failed with HTTP ${res.status}`;
  if (res.status === 405) {
    fallbackMessage =
      'API endpoint rejected this request (HTTP 405). Verify VITE_API_BASE_URL points to the Spring Boot API (/api), not a static web host.';
  } else if (res.status === 502 || res.status === 503) {
    fallbackMessage =
      'CURALITHRA API server is waking up or temporarily unavailable. Please wait a few seconds and retry.';
  }

  return new ApiRequestError(
    res.status,
    payload.message || fallbackMessage,
    payload.fieldErrors || {}
  );
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!isApiConfigured()) {
    throw new ApiRequestError(
      0,
      'CURALITHRA backend API URL is not configured for this hosted site. Set GitHub Actions variable VITE_API_BASE_URL to your Render API URL (e.g., https://curalithra-api.onrender.com/api) and redeploy.'
    );
  }

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
  if (!isApiConfigured()) {
    throw new ApiRequestError(
      0,
      'CURALITHRA backend API URL is not configured for this hosted site.'
    );
  }

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
