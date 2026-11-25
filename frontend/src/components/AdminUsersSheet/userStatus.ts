import { USER_STATUS, type AdminUser, type UserStatus } from '../../api/admin';

export const STATUS_LABEL: Record<UserStatus, string> = {
  [USER_STATUS.invited]: 'Eingeladen',
  [USER_STATUS.active]: 'Aktiv',
  [USER_STATUS.deactivated]: 'Deaktiviert',
};

/** When the user's newest invitation link runs out, or `null` once it has (or there is none). */
export function invitationValidUntil(user: AdminUser): string | null {
  const expiresAt = user.invitationExpiresAt;
  return expiresAt && new Date(expiresAt) > new Date() ? expiresAt : null;
}
