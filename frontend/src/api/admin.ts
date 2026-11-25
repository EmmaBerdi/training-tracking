import type { UserStatus } from '../types';
import { API_FAILURE, call, request } from './base';

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

async function post<T>(path: string, body?: unknown): Promise<AdminResult<T>> {
  const result = await call<T>(path, { method: 'POST', body });
  if (result.ok) return result.data;
  return result.kind === API_FAILURE.conflict ? 'conflict' : 'failed';
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
  const result = await call(`/admin/users/${id}`, { method: 'DELETE', body: { confirmEmail } });
  if (result.ok) return 'ok';
  return result.kind === API_FAILURE.invalid ? 'mismatch' : 'failed';
}
