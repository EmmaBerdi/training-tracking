import { authorizedFetch, request } from './base';

/** The account states the backend stores (`user.status`), mirrored from its CHECK constraint. */
export const USER_STATUS = {
  invited: 'invited',
  active: 'active',
  deactivated: 'deactivated',
} as const;
export type UserStatus = (typeof USER_STATUS)[keyof typeof USER_STATUS];

/** What an admin may see of an account: its metadata, never its plans, logs or images. */
export interface AdminUser {
  id: number;
  email: string;
  displayName: string | null;
  status: UserStatus;
  admin: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  /** When the newest invitation runs out, for an account still invited. */
  invitationExpiresAt: string | null;
}

/**
 * `invitationUrl` is only set when the mail couldn't go out. The token is stored hashed, so this
 * answer is the only time the link can be shown.
 */
export interface Invitation {
  user: AdminUser;
  invitationUrl: string | null;
}

export function listUsers(): Promise<AdminUser[] | null> {
  return request<AdminUser[]>('/admin/users');
}

export function resendInvitation(id: number): Promise<Invitation | null> {
  return request<Invitation>(`/admin/users/${id}/invitation`, { method: 'POST' });
}

export function deactivateUser(id: number): Promise<AdminUser | null> {
  return request<AdminUser>(`/admin/users/${id}/deactivate`, { method: 'POST' });
}

export function reactivateUser(id: number): Promise<AdminUser | null> {
  return request<AdminUser>(`/admin/users/${id}/reactivate`, { method: 'POST' });
}

export type InviteResult = Invitation | 'exists' | 'failed';

/**
 * Not built on `request()`, which folds every failure into `null`: an address that already has an
 * account is the one the admin can fix, so it has to be told apart.
 */
export async function inviteUser(email: string, displayName?: string): Promise<InviteResult> {
  try {
    const res = await authorizedFetch('/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, displayName: displayName || undefined }),
    });
    if (res.ok) return (await res.json()) as Invitation;
    return res.status === 409 ? 'exists' : 'failed';
  } catch (err) {
    console.error(err);
    return 'failed';
  }
}

export type DeleteResult = 'ok' | 'mismatch' | 'failed';

/**
 * `confirmEmail` repeats the address, so a mixed-up id can't delete the wrong account; it goes in
 * the body to stay out of access logs.
 */
export async function deleteUser(id: number, confirmEmail: string): Promise<DeleteResult> {
  try {
    const res = await authorizedFetch(`/admin/users/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmEmail }),
    });
    if (res.ok) return 'ok';
    return res.status === 400 ? 'mismatch' : 'failed';
  } catch (err) {
    console.error(err);
    return 'failed';
  }
}
