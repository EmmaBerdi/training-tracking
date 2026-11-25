import { apiBase } from '../api/base';

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  email: string;
  displayName: string | null;
  admin: boolean;
}

/** The account an invitation link is for, so the person sees what they are claiming. */
export interface InvitationInfo {
  email: string;
  displayName: string | null;
}

export class AuthError extends Error {}

const TOO_MANY_ATTEMPTS = 'Zu viele Versuche — bitte später erneut versuchen.';

async function post(path: string, body: unknown): Promise<Response> {
  return fetch(`${apiBase()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function parseOrThrow(res: Response, fallback: string): Promise<AuthResult> {
  if (res.ok) return (await res.json()) as AuthResult;
  if (res.status === 401) throw new AuthError('E-Mail oder Passwort ist falsch.');
  if (res.status === 429) throw new AuthError(TOO_MANY_ATTEMPTS);
  if (res.status === 400) {
    throw new AuthError('Bitte E-Mail und Passwort (mind. 8 Zeichen) prüfen.');
  }
  throw new AuthError(fallback);
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
  if (res.status === 429) throw new AuthError(TOO_MANY_ATTEMPTS);
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
  if (res.status === 429) throw new AuthError(TOO_MANY_ATTEMPTS);
  throw new AuthError('Zurücksetzen fehlgeschlagen — Backend erreichbar?');
}

/** The server gives one answer for an unknown, used, replaced or expired link. */
const INVALID_INVITATION =
  'Diese Einladung ist nicht mehr gültig. Bitte frag nach einem neuen Link.';

export async function lookupInvitation(token: string): Promise<InvitationInfo> {
  const res = await post('/auth/invitation/lookup', { token });
  if (res.ok) return (await res.json()) as InvitationInfo;
  if (res.status === 400) throw new AuthError(INVALID_INVITATION);
  if (res.status === 429) throw new AuthError(TOO_MANY_ATTEMPTS);
  throw new AuthError('Einladung konnte nicht geladen werden — Backend erreichbar?');
}

export async function acceptInvitation(
  token: string,
  password: string,
  displayName?: string,
): Promise<AuthResult> {
  const res = await post('/auth/invitation/accept', {
    token,
    password,
    displayName: displayName || undefined,
  });
  if (res.ok) return (await res.json()) as AuthResult;
  if (res.status === 400) throw new AuthError(INVALID_INVITATION);
  if (res.status === 429) throw new AuthError(TOO_MANY_ATTEMPTS);
  throw new AuthError('Passwort setzen fehlgeschlagen — Backend erreichbar?');
}
