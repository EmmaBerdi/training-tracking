import { send } from './base';

export type ChangePasswordResult = 'ok' | 'wrong-password' | 'failed';

/**
 * Not built on `request()`: that folds every failure into `null`, and a wrong current password is
 * the one failure the user can fix, so it has to be told apart.
 */
export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<ChangePasswordResult> {
  const res = await send('/account/password', {
    method: 'POST',
    body: { currentPassword, newPassword },
  });
  if (res?.ok) return 'ok';
  return res?.status === 400 ? 'wrong-password' : 'failed';
}

export type RequestEmailChangeResult = 'ok' | 'wrong-password' | 'taken' | 'too-many' | 'failed';

/** Mails a code to `newEmail`; the address only changes once that code is confirmed. */
export async function requestEmailChange(
  newEmail: string,
  currentPassword: string,
): Promise<RequestEmailChangeResult> {
  const res = await send('/account/email/request', {
    method: 'POST',
    body: { newEmail, currentPassword },
  });
  if (res?.ok) return 'ok';
  if (res?.status === 400) return 'wrong-password';
  if (res?.status === 409) return 'taken';
  if (res?.status === 429) return 'too-many';
  return 'failed';
}

export type ConfirmEmailChangeResult = { email: string } | 'invalid-code' | 'taken' | 'failed';

export async function confirmEmailChange(code: string): Promise<ConfirmEmailChangeResult> {
  const res = await send('/account/email/confirm', { method: 'POST', body: { code } });
  if (res?.ok) {
    try {
      return (await res.json()) as { email: string };
    } catch (err) {
      console.error(err);
      return 'failed';
    }
  }
  if (res?.status === 400) return 'invalid-code';
  if (res?.status === 409) return 'taken';
  return 'failed';
}
