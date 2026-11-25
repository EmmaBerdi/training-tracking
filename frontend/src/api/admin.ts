import { request, send } from './base';

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

/**
 * `conflict` is the backend's 409: the address already has an account, or the account's status no
 * longer allows the action because it changed since the list was loaded.
 */
export type AdminResult<T> = T | 'conflict' | 'failed';

/** Not built on `request()`, which folds every failure into `null`: a conflict has to be told apart. */
async function post<T>(path: string, body?: unknown): Promise<AdminResult<T>> {
  const res = await send(path, { method: 'POST', body });
  if (res?.ok) return (await res.json()) as T;
  return res?.status === 409 ? 'conflict' : 'failed';
}

export function listUsers(): Promise<AdminUser[] | null> {
  return request<AdminUser[]>('/admin/users');
}

export function inviteUser(email: string, displayName?: string): Promise<AdminResult<Invitation>> {
  return post('/admin/users', { email, displayName: displayName || undefined });
}

export function resendInvitation(id: number): Promise<AdminResult<Invitation>> {
  return post(`/admin/users/${id}/invitation`);
}

export function deactivateUser(id: number): Promise<AdminResult<AdminUser>> {
  return post(`/admin/users/${id}/deactivate`);
}

export function reactivateUser(id: number): Promise<AdminResult<AdminUser>> {
  return post(`/admin/users/${id}/reactivate`);
}

export type DeleteResult = 'ok' | 'mismatch' | 'failed';

/**
 * `confirmEmail` repeats the address, so a mixed-up id can't delete the wrong account; it goes in
 * the body to stay out of access logs.
 */
export async function deleteUser(id: number, confirmEmail: string): Promise<DeleteResult> {
  const res = await send(`/admin/users/${id}`, { method: 'DELETE', body: { confirmEmail } });
  if (res?.ok) return 'ok';
  return res?.status === 400 ? 'mismatch' : 'failed';
}
