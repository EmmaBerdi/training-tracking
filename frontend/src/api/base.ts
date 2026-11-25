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

/** Why a request failed, sorted by what a caller could do about it. */
export const API_FAILURE = {
  /** No answer arrived: the device is offline or the server can't be reached. */
  offline: 'offline',
  /** Still 401 after a token refresh: the session is gone. */
  auth: 'auth',
  /** 400: the server rejected the input. */
  invalid: 'invalid',
  /** 409: the request clashes with what the server holds now. */
  conflict: 'conflict',
  /** 429: too many attempts; trying again later can work. */
  rateLimited: 'rate-limited',
  /** Any other status, or an answer that couldn't be read. */
  server: 'server',
} as const;

export type ApiFailure = (typeof API_FAILURE)[keyof typeof API_FAILURE];

export type ApiResult<T> = { ok: true; data: T } | { ok: false; kind: ApiFailure; status?: number };

function failureKind(status: number): ApiFailure {
  switch (status) {
    case 400:
      return API_FAILURE.invalid;
    case 401:
      return API_FAILURE.auth;
    case 409:
      return API_FAILURE.conflict;
    case 429:
      return API_FAILURE.rateLimited;
    default:
      return API_FAILURE.server;
  }
}

/**
 * One request, decoded, with the reason when it failed. An answer without a body — a 204, or the
 * 202 of an email change request — comes back as `NO_CONTENT`.
 */
export async function call<T>(path: string, options: RequestOptions = {}): Promise<ApiResult<T>> {
  const { method = 'GET', body } = options;
  let res: Response;
  try {
    res = await authorizedFetch(path, {
      method,
      headers: body === undefined ? undefined : JSON_HEADERS,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (err) {
    console.error(err);
    return { ok: false, kind: API_FAILURE.offline };
  }
  if (!res.ok) {
    console.error(`HTTP ${res.status} on ${method} ${path}`);
    return { ok: false, kind: failureKind(res.status), status: res.status };
  }
  try {
    const text = await res.text();
    return { ok: true, data: (text ? JSON.parse(text) : NO_CONTENT) as T };
  } catch (err) {
    console.error(err);
    return { ok: false, kind: API_FAILURE.server, status: res.status };
  }
}

/**
 * `call()` for the callers that react to every failure the same way: leave the UI as it was and
 * show a toast. `null` for any failure; the reason is only logged.
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T | null> {
  const result = await call<T>(path, options);
  return result.ok ? result.data : null;
}

/** A request whose only interesting outcome is whether it succeeded. */
export async function requestOk(path: string, options: RequestOptions = {}): Promise<boolean> {
  return (await call<unknown>(path, options)).ok;
}
