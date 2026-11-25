import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
  inviteUser,
  listUsers,
  USER_STATUS,
  type AdminUser,
  type Invitation,
  type UserStatus,
} from '../../api/admin';
import { formatInstant } from '../../utils/date';
import { InvitationSent } from './InvitationSent';
import { UserDetail } from './UserDetail';
import { invitationValidUntil, STATUS_LABEL } from './userStatus';
import styles from './AdminUsersSheet.module.scss';

interface AdminUsersSheetProps {
  /** The admin's own address: their row is marked, and it offers nothing to do to it. */
  currentEmail: string;
  onError: (message: string) => void;
  onClose: () => void;
}

/** The list, one user opened from it, or the invitation just made. */
type View =
  { kind: 'list' } | { kind: 'user'; id: number } | { kind: 'invited'; invitation: Invitation };

const STATUS_DOT: Record<UserStatus, string> = {
  [USER_STATUS.invited]: styles.dotInvited,
  [USER_STATUS.active]: styles.dotActive,
  [USER_STATUS.deactivated]: styles.dotDeactivated,
};

export function AdminUsersSheet({ currentEmail, onError, onClose }: AdminUsersSheetProps) {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [view, setView] = useState<View>({ kind: 'list' });
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Bumped to load the list again after it turned out to be out of date.
  const [loadCount, setLoadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    listUsers().then((list) => {
      if (cancelled) return;
      if (list) setUsers(list);
      else onError('Benutzer konnten nicht geladen werden.');
    });
    return () => {
      cancelled = true;
    };
  }, [onError, loadCount]);

  const replaceUser = (user: AdminUser) =>
    setUsers((list) => list?.map((u) => (u.id === user.id ? user : u)) ?? list);

  const handleInvite = async (e: FormEvent) => {
    e.preventDefault();
    setInviteError(null);
    setBusy(true);
    const result = await inviteUser(email.trim(), displayName.trim());
    setBusy(false);
    if (result === 'conflict') setInviteError('Zu dieser E-Mail gibt es schon ein Konto.');
    else if (result === 'failed') setInviteError('Einladen fehlgeschlagen — Backend erreichbar?');
    else {
      setUsers((list) => (list ? [...list, result.user] : list));
      setEmail('');
      setDisplayName('');
      setView({ kind: 'invited', invitation: result });
    }
  };

  if (view.kind === 'invited') {
    return <InvitationSent invitation={view.invitation} onDone={() => setView({ kind: 'list' })} />;
  }

  const opened = view.kind === 'user' ? users?.find((u) => u.id === view.id) : undefined;
  if (opened) {
    return (
      <UserDetail
        user={opened}
        onChanged={replaceUser}
        onResent={(invitation) => {
          replaceUser(invitation.user);
          setView({ kind: 'invited', invitation });
        }}
        onDeleted={() => {
          setUsers((list) => list?.filter((u) => u.id !== opened.id) ?? list);
          setView({ kind: 'list' });
        }}
        onStale={() => {
          onError('Der Benutzer wurde inzwischen geändert. Die Liste ist neu geladen.');
          setLoadCount((n) => n + 1);
        }}
        onError={onError}
        onBack={() => setView({ kind: 'list' })}
      />
    );
  }

  return (
    <div>
      <h2 className={styles.title}>Benutzer verwalten</h2>
      <div className={styles.sub}>
        Nur Kontodaten. Trainingspläne, Einträge und Bilder bleiben privat.
      </div>

      <form className={styles.card} onSubmit={handleInvite}>
        <div className={styles.cardTitle}>Neue Person einladen</div>
        <div className={styles.field}>
          <label htmlFor="invite-email">E-Mail</label>
          <input
            id="invite-email"
            type="email"
            autoComplete="off"
            autoCapitalize="none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="invite-name">Name (optional)</label>
          <input
            id="invite-name"
            type="text"
            autoComplete="off"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
        {inviteError && <div className={styles.error}>{inviteError}</div>}
        <button type="submit" className={styles.solid} disabled={busy}>
          Einladung senden
        </button>
      </form>

      {users && (
        <>
          <div className={styles.listHead}>
            Benutzer <span className={styles.count}>{users.length}</span>
          </div>
          <ul className={styles.list}>
            {users.map((user) => {
              const own = user.email === currentEmail;
              const invited = user.status === USER_STATUS.invited;
              return (
                <li key={user.id}>
                  <button
                    type="button"
                    className={styles.row}
                    disabled={own}
                    onClick={() => setView({ kind: 'user', id: user.id })}
                  >
                    <span className={styles.rowText}>
                      <span className={styles.rowEmail}>
                        <span
                          className={`${styles.dot} ${STATUS_DOT[user.status]}`}
                          aria-hidden="true"
                        />
                        <span>{user.email}</span>
                        {own && <span className={styles.badge}>Du</span>}
                        {user.admin && !own && <span className={styles.badge}>Admin</span>}
                      </span>
                      <span className={`${styles.rowMeta} ${invited ? styles.invited : ''}`}>
                        {rowMeta(user)}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <button type="button" className={styles.ghost} onClick={onClose}>
        Schließen
      </button>
    </div>
  );
}

function rowMeta(user: AdminUser): string {
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
