import type { AdminUser } from '../../api/admin';
import { USER_STATUS } from '../../data/constants';
import type { UserStatus } from '../../types';
import { formatInstant } from '../../utils/date';

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

/** The line under the address in the list. */
export function userSummary(user: AdminUser): string {
  if (user.status === USER_STATUS.invited) {
    const validUntil = invitationValidUntil(user);
    return validUntil
      ? `Eingeladen · gültig bis ${formatInstant(validUntil)}`
      : 'Eingeladen · Link abgelaufen';
  }
  const parts = [user.displayName, STATUS_LABEL[user.status]];
  if (user.lastLoginAt) parts.push(`zuletzt ${formatInstant(user.lastLoginAt)}`);
  return parts.filter(Boolean).join(' · ');
}
