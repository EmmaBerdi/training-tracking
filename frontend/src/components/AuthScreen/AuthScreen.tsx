import { useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../../auth/useAuth';
import { AuthError, confirmPasswordReset, requestPasswordReset } from '../../auth/authClient';
import styles from './AuthScreen.module.scss';

/** `forgot` asks for the address to mail a code to; `reset` takes that code and the new password. */
type Mode = 'login' | 'register' | 'forgot' | 'reset';

const TITLE: Record<Mode, string> = {
  login: 'Anmelden',
  register: 'Konto erstellen',
  forgot: 'Passwort vergessen',
  reset: 'Neues Passwort',
};

const SUBMIT: Record<Mode, string> = {
  login: 'Anmelden',
  register: 'Konto erstellen',
  forgot: 'Code senden',
  reset: 'Passwort speichern',
};

export function AuthScreen() {
  const { login, register, notice: logoutNotice } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(logoutNotice);
  const [busy, setBusy] = useState(false);

  const switchTo = (next: Mode) => {
    setMode(next);
    setError(null);
    setNotice(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'login') await login(email, password);
      else if (mode === 'register') await register(email, password, displayName.trim());
      else if (mode === 'forgot') {
        await requestPasswordReset(email);
        switchTo('reset');
      } else {
        await confirmPasswordReset(email, code, password);
        setPassword('');
        setCode('');
        switchTo('login');
        setNotice('Passwort geändert — bitte mit dem neuen Passwort anmelden.');
      }
    } catch (err) {
      setError(err instanceof AuthError ? err.message : 'Etwas ist schiefgelaufen.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.eyebrow}>Training</div>
      <h1 className={styles.title}>{TITLE[mode]}</h1>
      {mode === 'forgot' && (
        <p className={styles.sub}>
          Wir schicken dir einen Code, mit dem du ein neues Passwort setzt.
        </p>
      )}
      {mode === 'reset' && (
        <p className={styles.sub}>
          Falls zu {email} ein Konto existiert, ist ein 6-stelliger Code unterwegs. Er ist 15
          Minuten gültig.
        </p>
      )}
      {notice && <p className={styles.sub}>{notice}</p>}

      <form className={styles.form} onSubmit={handleSubmit}>
        <input
          className={styles.input}
          type="email"
          placeholder="E-Mail"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        {mode === 'register' && (
          <input
            className={styles.input}
            type="text"
            placeholder="Anzeigename (optional)"
            autoComplete="nickname"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        )}
        {mode === 'reset' && (
          <input
            className={styles.input}
            type="text"
            inputMode="numeric"
            placeholder="Code"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.trim())}
            required
          />
        )}
        {mode !== 'forgot' && (
          <input
            className={styles.input}
            type="password"
            placeholder={mode === 'reset' ? 'Neues Passwort' : 'Passwort'}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={mode === 'login' ? undefined : 8}
            required
          />
        )}

        {error && <div className={styles.error}>{error}</div>}

        <button type="submit" className={styles.solid} disabled={busy}>
          {SUBMIT[mode]}
        </button>
      </form>

      {mode === 'login' && (
        <button type="button" className={styles.link} onClick={() => switchTo('forgot')}>
          Passwort vergessen?
        </button>
      )}
      {mode === 'reset' && (
        <button type="button" className={styles.link} onClick={() => switchTo('forgot')}>
          Neuen Code anfordern
        </button>
      )}

      <button
        type="button"
        className={styles.toggle}
        onClick={() => switchTo(mode === 'login' ? 'register' : 'login')}
      >
        {mode === 'login'
          ? 'Noch kein Konto? Registrieren'
          : mode === 'register'
            ? 'Schon registriert? Anmelden'
            : 'Zurück zur Anmeldung'}
      </button>
    </div>
  );
}
