import { USER_STATUS } from '../../data/constants';
import type { UserStatus } from '../../types';
import { InvitationSent } from './InvitationSent';
import { UserDetail } from './UserDetail';
import { useAdminUsers } from './useAdminUsers';
import { userSummary } from './userStatus';
import styles from './AdminUsersSheet.module.scss';

interface AdminUsersSheetProps {
  /** The admin's own address: their row is marked, and it offers nothing to do to it. */
  currentEmail: string;
  onError: (message: string) => void;
  onClose: () => void;
}

const STATUS_DOT: Record<UserStatus, string> = {
  [USER_STATUS.invited]: styles.dotInvited,
  [USER_STATUS.active]: styles.dotActive,
  [USER_STATUS.deactivated]: styles.dotDeactivated,
};

export function AdminUsersSheet({ currentEmail, onError, onClose }: AdminUsersSheetProps) {
  const sheet = useAdminUsers(onError);

  if (sheet.invitation) {
    return <InvitationSent invitation={sheet.invitation} onDone={sheet.showList} />;
  }

  if (sheet.opened) {
    return (
      <UserDetail
        user={sheet.opened}
        onChanged={sheet.handleChanged}
        onResent={sheet.handleResent}
        onDeleted={sheet.handleDeleted}
        onStale={sheet.handleStale}
        onError={onError}
        onBack={sheet.showList}
      />
    );
  }

  return (
    <div>
      <h2 className={styles.title}>Benutzer verwalten</h2>
      <div className={styles.sub}>
        Nur Kontodaten. Trainingspläne, Einträge und Bilder bleiben privat.
      </div>

      <form className={styles.card} onSubmit={sheet.handleInvite}>
        <div className={styles.cardTitle}>Neue Person einladen</div>
        <div className={styles.field}>
          <label htmlFor="invite-email">E-Mail</label>
          <input
            id="invite-email"
            type="email"
            autoComplete="off"
            autoCapitalize="none"
            value={sheet.email}
            onChange={(e) => sheet.setEmail(e.target.value)}
            required
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="invite-name">Name (optional)</label>
          <input
            id="invite-name"
            type="text"
            autoComplete="off"
            value={sheet.displayName}
            onChange={(e) => sheet.setDisplayName(e.target.value)}
          />
        </div>
        {sheet.inviteError && <div className={styles.error}>{sheet.inviteError}</div>}
        <button type="submit" className={styles.solid} disabled={sheet.busy}>
          Einladung senden
        </button>
      </form>

      {sheet.users && (
        <>
          <div className={styles.listHead}>
            Benutzer <span className={styles.count}>{sheet.users.length}</span>
          </div>
          <ul className={styles.list}>
            {sheet.users.map((user) => {
              const own = user.email === currentEmail;
              const invited = user.status === USER_STATUS.invited;
              return (
                <li key={user.id}>
                  <button
                    type="button"
                    className={styles.row}
                    disabled={own}
                    onClick={() => sheet.openUser(user.id)}
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
                        {userSummary(user)}
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
