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
