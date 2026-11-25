import { USER_STATUS, type AdminUser, type UserStatus } from '../../api/admin';

export const STATUS_LABEL: Record<UserStatus, string> = {
  [USER_STATUS.invited]: 'Eingeladen',
  [USER_STATUS.active]: 'Aktiv',
  [USER_STATUS.deactivated]: 'Deaktiviert',
};

/** Whether the account's newest link still works; an expired one keeps its date. */
export function invitationOpen(user: AdminUser): boolean {
  return !!user.invitationExpiresAt && new Date(user.invitationExpiresAt) > new Date();
}
