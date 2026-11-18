import { apiBase } from '../api/base';

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  email: string;
  displayName: string | null;
}

export class AuthError extends Error {}

async function post(path: string, body: unknown): Promise<Response> {
  return fetch(`${apiBase()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function parseOrThrow(res: Response, fallback: string): Promise<AuthResult> {
  if (res.ok) return (await res.json()) as AuthResult;
  if (res.status === 409) throw new AuthError('Diese E-Mail ist bereits registriert.');
  if (res.status === 401) throw new AuthError('E-Mail oder Passwort ist falsch.');
  if (res.status === 400) {
    throw new AuthError('Bitte E-Mail und Passwort (mind. 8 Zeichen) prüfen.');
  }
  throw new AuthError(fallback);
}

export async function register(
  email: string,
  password: string,
  displayName?: string,
): Promise<AuthResult> {
  const res = await post('/auth/register', {
    email,
    password,
    displayName: displayName || undefined,
  });
  return parseOrThrow(res, 'Registrierung fehlgeschlagen — Backend erreichbar?');
}

export async function login(email: string, password: string): Promise<AuthResult> {
  const res = await post('/auth/login', { email, password });
  return parseOrThrow(res, 'Login fehlgeschlagen — Backend erreichbar?');
}

export async function refresh(refreshToken: string): Promise<AuthResult> {
  const res = await post('/auth/refresh', { refreshToken });
  return parseOrThrow(res, 'Sitzung abgelaufen');
}

export async function logout(refreshToken: string): Promise<void> {
  await post('/auth/logout', { refreshToken }).catch(() => undefined);
}

/** Answers the same whether or not the address has an account; the server only mails real ones. */
export async function requestPasswordReset(email: string): Promise<void> {
  const res = await post('/auth/password-reset/request', { email });
  if (res.ok) return;
  if (res.status === 400) throw new AuthError('Bitte eine gültige E-Mail eingeben.');
  throw new AuthError('Anfrage fehlgeschlagen — Backend erreichbar?');
}

export async function confirmPasswordReset(
  email: string,
  code: string,
  newPassword: string,
): Promise<void> {
  const res = await post('/auth/password-reset/confirm', { email, code, newPassword });
  if (res.ok) return;
  if (res.status === 400) throw new AuthError('Code ungültig oder abgelaufen.');
  throw new AuthError('Zurücksetzen fehlgeschlagen — Backend erreichbar?');
}
