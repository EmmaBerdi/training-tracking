import { useState } from 'react';
import type { FormEvent } from 'react';
import { confirmEmailChange, requestEmailChange } from '../../api/account';
import { CodeInput } from '../CodeInput/CodeInput';
import styles from './ChangeEmailSheet.module.scss';

interface ChangeEmailSheetProps {
  currentEmail: string;
  /** Called with the address the server now has; the session stays open. */
  onChanged: (email: string) => void;
  onClose: () => void;
}

/** `address` asks for the new address and the password; `code` takes the code mailed there. */
type Step = 'address' | 'code';

export function ChangeEmailSheet({ currentEmail, onChanged, onClose }: ChangeEmailSheetProps) {
  const [step, setStep] = useState<Step>('address');
  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const requestCode = async () => {
    if (newEmail.trim().toLowerCase() === currentEmail.toLowerCase()) {
      setError('Das ist schon deine Adresse.');
      return;
    }
    setBusy(true);
    const result = await requestEmailChange(newEmail, password);
    setBusy(false);
    if (result === 'ok') {
      setCode('');
      setStep('code');
    } else if (result === 'wrong-password') setError('Aktuelles Passwort ist falsch.');
    else if (result === 'taken') setError('Diese Adresse gehört schon zu einem Konto.');
    else if (result === 'too-many')
      setError('Zu viele Codes angefordert — versuch es in einer Stunde nochmal.');
    else setError('Senden fehlgeschlagen — Backend erreichbar?');
  };

  const confirmCode = async () => {
    setBusy(true);
    const result = await confirmEmailChange(code);
    setBusy(false);
    if (typeof result === 'object') onChanged(result.email);
    else if (result === 'invalid-code') setError('Code falsch oder abgelaufen.');
    else if (result === 'taken')
      setError('Diese Adresse gehört inzwischen zu einem anderen Konto.');
    else setError('Bestätigen fehlgeschlagen — Backend erreichbar?');
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    void (step === 'address' ? requestCode() : confirmCode());
  };

  const back = () => {
    setError(null);
    setStep('address');
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2 className={styles.title}>E-Mail-Adresse ändern</h2>

      {step === 'address' ? (
        <>
          <div className={styles.sub}>
            Bisher {currentEmail}. Wir schicken einen Code an die neue Adresse.
          </div>
          <div className={styles.field}>
            <label htmlFor="email-new">Neue E-Mail-Adresse</label>
            <input
              id="email-new"
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              required
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="email-password">Aktuelles Passwort</label>
            <input
              id="email-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
        </>
      ) : (
        <>
          <div className={styles.sub}>
            Ein 6-stelliger Code ist an {newEmail.trim()} unterwegs. Er ist 15 Minuten gültig —
            keine E-Mail erhalten? Schau auch im Spam-Ordner nach.
          </div>
          <div className={styles.field}>
            <label htmlFor="email-code">Code</label>
            <CodeInput id="email-code" value={code} onChange={setCode} />
          </div>
        </>
      )}

      {error && <div className={styles.error}>{error}</div>}

      <button type="submit" className={styles.solid} disabled={busy}>
        {step === 'address' ? 'Code senden' : 'Adresse ändern'}
      </button>
      {step === 'address' ? (
        <button type="button" className={styles.ghost} onClick={onClose}>
          Abbrechen
        </button>
      ) : (
        <button type="button" className={styles.ghost} onClick={back}>
          Neuen Code anfordern
        </button>
      )}
    </form>
  );
}
