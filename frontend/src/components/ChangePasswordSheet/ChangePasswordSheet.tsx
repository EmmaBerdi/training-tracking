import { useState } from 'react';
import type { FormEvent } from 'react';
import { changePassword } from '../../api/account';
import styles from './ChangePasswordSheet.module.scss';

interface ChangePasswordSheetProps {
  /** Called once the server took the new password; every session, this one too, has ended. */
  onChanged: () => void;
  onClose: () => void;
}

export function ChangePasswordSheet({ onChanged, onClose }: ChangePasswordSheetProps) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (next !== repeat) {
      setError('Die neuen Passwörter stimmen nicht überein.');
      return;
    }
    setError(null);
    setBusy(true);
    const result = await changePassword(current, next);
    setBusy(false);
    if (result === 'ok') onChanged();
    else if (result === 'wrong-password') setError('Aktuelles Passwort ist falsch.');
    else setError('Ändern fehlgeschlagen — Backend erreichbar?');
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2 className={styles.title}>Passwort ändern</h2>
      <div className={styles.sub}>Danach meldest du dich auf allen Geräten neu an.</div>

      <div className={styles.field}>
        <label htmlFor="pw-current">Aktuelles Passwort</label>
        <input
          id="pw-current"
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          required
        />
      </div>
      <div className={styles.field}>
        <label htmlFor="pw-new">Neues Passwort</label>
        <input
          id="pw-new"
          type="password"
          autoComplete="new-password"
          minLength={8}
          value={next}
          onChange={(e) => setNext(e.target.value)}
          required
        />
      </div>
      <div className={styles.field}>
        <label htmlFor="pw-repeat">Neues Passwort wiederholen</label>
        <input
          id="pw-repeat"
          type="password"
          autoComplete="new-password"
          minLength={8}
          value={repeat}
          onChange={(e) => setRepeat(e.target.value)}
          required
        />
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <button type="submit" className={styles.solid} disabled={busy}>
        Passwort ändern
      </button>
      <button type="button" className={styles.ghost} onClick={onClose}>
        Abbrechen
      </button>
    </form>
  );
}
