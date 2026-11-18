import { getAccessToken, getRefreshToken, setTokens, clearTokens } from '../auth/tokenStore';
import { refresh as refreshTokens } from '../auth/authClient';

const DEFAULT_API_BASE = 'http://localhost:8080/api';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

/**
 * `window.API_BASE`, set via an inline script before the bundle loads, lets a static deploy
 * point at its backend without a rebuild — see docs/BACKEND.md.
 */
export function apiBase(): string {
  return window.API_BASE || import.meta.env.VITE_API_BASE || DEFAULT_API_BASE;
}

let refreshInFlight: Promise<string | null> | null = null;

/** Coalesces concurrent 401s into a single refresh call instead of racing multiple rotations. */
function refreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = doRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

async function doRefresh(): Promise<string | null> {
  const rt = getRefreshToken();
  if (!rt) return null;
  try {
    const result = await refreshTokens(rt);
    setTokens({ accessToken: result.accessToken, refreshToken: result.refreshToken });
    return result.accessToken;
  } catch {
    clearTokens();
    return null;
  }
}

/**
 * Shared low-level fetch: attaches the bearer token and retries once after a 401 refresh. Exported
 * for the two calls JSON can't carry — uploading a picture and reading its bytes back.
 */
export async function authorizedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = getAccessToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let res = await fetch(`${apiBase()}${path}`, { ...init, headers });
  if (res.status === 401) {
    const refreshedToken = await refreshAccessToken();
    if (refreshedToken) {
      headers.set('Authorization', `Bearer ${refreshedToken}`);
      res = await fetch(`${apiBase()}${path}`, { ...init, headers });
    }
  }
  return res;
}

/**
 * A scope=future write answers 204: it changed every later occurrence of the series, so there is no
 * single session to return and the caller has to reload the visible range.
 */
export const NO_CONTENT = 'no-content';
export type NoContent = typeof NO_CONTENT;

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
}

/**
 * One request, decoded. Returns `null` for anything that went wrong — network, auth, validation —
 * because every caller reacts the same way: leave the UI as it was and show a toast. The reason is
 * logged rather than surfaced, since none of it is actionable for the user.
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T | null> {
  const { method = 'GET', body } = options;
  try {
    const res = await authorizedFetch(path, {
      method,
      headers: body === undefined ? undefined : JSON_HEADERS,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} on ${method} ${path}`);
    if (res.status === 204) return NO_CONTENT as T;
    return (await res.json()) as T;
  } catch (err) {
    console.error(err);
    return null;
  }
}

/** A request whose only interesting outcome is whether it succeeded. */
export async function requestOk(path: string, options: RequestOptions = {}): Promise<boolean> {
  return (await request<unknown>(path, options)) !== null;
}
