import { useState } from 'react';
import type { FormEvent } from 'react';
import {
  deactivateUser,
  deleteUser,
  reactivateUser,
  resendInvitation,
  USER_STATUS,
  type AdminResult,
  type AdminUser,
  type Invitation,
} from '../../api/admin';
import { formatInstant } from '../../utils/date';
import { invitationValidUntil, STATUS_LABEL } from './userStatus';
import styles from './AdminUsersSheet.module.scss';

interface UserDetailProps {
  user: AdminUser;
  onChanged: (user: AdminUser) => void;
  onResent: (invitation: Invitation) => void;
  onDeleted: () => void;
  /** The user's status changed elsewhere since the list was loaded, so the action no longer fits. */
  onStale: () => void;
  onError: (message: string) => void;
  onBack: () => void;
}

export function UserDetail({
  user,
  onChanged,
  onResent,
  onDeleted,
  onStale,
  onError,
  onBack,
}: UserDetailProps) {
  const [confirmEmail, setConfirmEmail] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Only a hint for the button: the server compares the address again before deleting anything.
  const confirmed = confirmEmail.trim().toLowerCase() === user.email.toLowerCase();
  const name = user.displayName || user.email;
  const validUntil = invitationValidUntil(user);

  const runAction = async <T,>(
    action: () => Promise<AdminResult<T>>,
    done: (result: T) => void,
  ) => {
    setBusy(true);
    const result = await action();
    setBusy(false);
    if (result === 'conflict') onStale();
    else if (result === 'failed') onError('Das hat nicht geklappt — Backend erreichbar?');
    else done(result);
  };

  const handleDelete = async (e: FormEvent) => {
    e.preventDefault();
    setDeleteError(null);
    setBusy(true);
    const result = await deleteUser(user.id, confirmEmail.trim());
    setBusy(false);
    if (result === 'ok') onDeleted();
    else if (result === 'mismatch')
      setDeleteError('Die E-Mail stimmt nicht mit dem Konto überein.');
    else setDeleteError('Löschen fehlgeschlagen — Backend erreichbar?');
  };

  return (
    <div>
      <h2 className={styles.title}>{user.email}</h2>
      {user.displayName && <div className={styles.sub}>{user.displayName}</div>}

      <dl className={styles.facts}>
        <div>
          <dt>Status</dt>
          <dd>{STATUS_LABEL[user.status]}</dd>
        </div>
        <div>
          <dt>Erstellt</dt>
          <dd>{formatInstant(user.createdAt)}</dd>
        </div>
        {user.status === USER_STATUS.invited ? (
          <div>
            <dt>Einladung</dt>
            <dd>{validUntil ? `bis ${formatInstant(validUntil)}` : 'abgelaufen'}</dd>
          </div>
        ) : (
          <div>
            <dt>Letzter Login</dt>
            <dd>{user.lastLoginAt ? formatInstant(user.lastLoginAt) : '–'}</dd>
          </div>
        )}
        <div>
          <dt>Rolle</dt>
          <dd>{user.admin ? 'Admin' : 'Benutzer'}</dd>
        </div>
      </dl>

      {user.status === USER_STATUS.invited && (
        <>
          <button
            type="button"
            className={styles.outline}
            disabled={busy}
            onClick={() => runAction(() => resendInvitation(user.id), onResent)}
          >
            Einladung neu senden
          </button>
          <div className={styles.hint}>Der bisherige Link funktioniert danach nicht mehr.</div>
        </>
      )}
      {user.status === USER_STATUS.active && (
        <>
          <button
            type="button"
            className={styles.outline}
            disabled={busy}
            onClick={() => runAction(() => deactivateUser(user.id), onChanged)}
          >
            Deaktivieren
          </button>
          <div className={styles.hint}>
            Meldet {name} auf allen Geräten ab. Die Daten bleiben erhalten, das Konto lässt sich
            wieder aktivieren.
          </div>
        </>
      )}
      {user.status === USER_STATUS.deactivated && (
        <>
          <button
            type="button"
            className={styles.outline}
            disabled={busy}
            onClick={() => runAction(() => reactivateUser(user.id), onChanged)}
          >
            Wieder aktivieren
          </button>
          <div className={styles.hint}>{name} kann sich danach wieder anmelden.</div>
        </>
      )}

      <form className={styles.danger} onSubmit={handleDelete}>
        <div className={styles.dangerTitle}>Konto endgültig löschen</div>
        <div className={styles.dangerText}>
          Löscht das Konto mit allen Plänen, Einträgen, Timern und Bildern. Das lässt sich nicht
          rückgängig machen.
        </div>
        <div className={styles.field}>
          <label htmlFor="delete-confirm">Zur Bestätigung die E-Mail eintippen</label>
          <input
            id="delete-confirm"
            type="text"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            value={confirmEmail}
            onChange={(e) => setConfirmEmail(e.target.value)}
          />
        </div>
        {deleteError && <div className={styles.error}>{deleteError}</div>}
        <button type="submit" className={styles.solid} disabled={busy || !confirmed}>
          Endgültig löschen
        </button>
      </form>

      <button type="button" className={styles.ghost} onClick={onBack}>
        Zurück
      </button>
    </div>
  );
}
