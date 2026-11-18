const REFRESH_TOKEN_KEY = 'refreshToken';

let accessToken: string | null = null;
let refreshToken: string | null = localStorage.getItem(REFRESH_TOKEN_KEY);
let onExpired: (() => void) | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function getRefreshToken(): string | null {
  return refreshToken;
}

export function setTokens(next: { accessToken: string; refreshToken: string }): void {
  accessToken = next.accessToken;
  refreshToken = next.refreshToken;
  localStorage.setItem(REFRESH_TOKEN_KEY, next.refreshToken);
}

/** Drops both tokens and, if a session was active, notifies the auth context to log out the UI. */
export function clearTokens(): void {
  const hadSession = accessToken !== null || refreshToken !== null;
  accessToken = null;
  refreshToken = null;
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  if (hadSession) onExpired?.();
}

/**
 * Called by AuthProvider so a forced logout (e.g. a failed background refresh) updates the UI.
 * Returns a function that unregisters the listener again.
 */
export function registerOnExpired(listener: () => void): () => void {
  onExpired = listener;
  return () => {
    if (onExpired === listener) onExpired = null;
  };
}
