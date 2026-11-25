import { useRef, useState } from 'react';
import type { Invitation } from '../../api/admin';
import { formatInstant } from '../../utils/date';
import styles from './AdminUsersSheet.module.scss';

interface InvitationSentProps {
  invitation: Invitation;
  onDone: () => void;
}

export function InvitationSent({ invitation, onDone }: InvitationSentProps) {
  const { user, invitationUrl } = invitation;
  const linkRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);
  const validUntil = user.invitationExpiresAt ? formatInstant(user.invitationExpiresAt) : null;

  const copy = async () => {
    if (!invitationUrl) return;
    try {
      await navigator.clipboard.writeText(invitationUrl);
      setCopied(true);
    } catch {
      // No clipboard access (an http dev server, an old browser): select it for a manual copy.
      linkRef.current?.select();
    }
  };

  return (
    <div>
      <h2 className={styles.title}>Einladung erstellt</h2>
      <div className={styles.sub}>
        {user.email} kann sich anmelden, sobald ein Passwort gesetzt ist.
      </div>

      {invitationUrl ? (
        <>
          <div className={`${styles.hint} ${styles.invited}`}>
            Die E-Mail konnte nicht verschickt werden. Gib den Link selbst weiter:
          </div>
          <div className={styles.field}>
            <label htmlFor="invite-link">Einladungslink</label>
            <div className={styles.linkRow}>
              <input
                id="invite-link"
                ref={linkRef}
                type="text"
                readOnly
                value={invitationUrl}
                onFocus={(e) => e.target.select()}
              />
              <button type="button" className={styles.copy} onClick={copy}>
                {copied ? 'Kopiert' : 'Kopieren'}
              </button>
            </div>
          </div>
          <div className={styles.hint}>
            Er funktioniert genau einmal{validUntil && ` und ist bis ${validUntil} gültig`}. Er wird
            nur jetzt angezeigt.
          </div>
        </>
      ) : (
        <div className={styles.hint}>
          Einladung per E-Mail gesendet{validUntil && `, der Link ist bis ${validUntil} gültig`}.
        </div>
      )}

      <button type="button" className={styles.solid} onClick={onDone}>
        Fertig
      </button>
    </div>
  );
}
