import { API_FAILURE, call } from './base';

export type ChangePasswordResult = 'ok' | 'wrong-password' | 'failed';

/** A wrong current password is the one failure the user can fix, so it is told apart. */
export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<ChangePasswordResult> {
  const result = await call('/account/password', {
    method: 'POST',
    body: { currentPassword, newPassword },
  });
  if (result.ok) return 'ok';
  return result.kind === API_FAILURE.invalid ? 'wrong-password' : 'failed';
}

export type RequestEmailChangeResult = 'ok' | 'wrong-password' | 'taken' | 'too-many' | 'failed';

/** Mails a code to `newEmail`; the address only changes once that code is confirmed. */
export async function requestEmailChange(
  newEmail: string,
  currentPassword: string,
): Promise<RequestEmailChangeResult> {
  const result = await call('/account/email/request', {
    method: 'POST',
    body: { newEmail, currentPassword },
  });
  if (result.ok) return 'ok';
  if (result.kind === API_FAILURE.invalid) return 'wrong-password';
  if (result.kind === API_FAILURE.conflict) return 'taken';
  if (result.kind === API_FAILURE.rateLimited) return 'too-many';
  return 'failed';
}

export type ConfirmEmailChangeResult = { email: string } | 'invalid-code' | 'taken' | 'failed';

export async function confirmEmailChange(code: string): Promise<ConfirmEmailChangeResult> {
  const result = await call<{ email: string }>('/account/email/confirm', {
    method: 'POST',
    body: { code },
  });
  if (result.ok) return result.data;
  if (result.kind === API_FAILURE.invalid) return 'invalid-code';
  if (result.kind === API_FAILURE.conflict) return 'taken';
  return 'failed';
}
