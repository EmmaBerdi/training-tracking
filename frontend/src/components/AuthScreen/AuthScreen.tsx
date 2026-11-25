import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../../auth/useAuth';
import {
  AuthError,
  confirmPasswordReset,
  lookupInvitation,
  requestPasswordReset,
  type InvitationInfo,
} from '../../auth/authClient';
import { CodeInput } from '../CodeInput/CodeInput';
import styles from './AuthScreen.module.scss';

/**
 * `forgot` asks for the address to mail a code to; `reset` takes that code and the new password.
 * `invite` sets the first password of an account an admin created, from its invitation link.
 */
type Mode = 'login' | 'invite' | 'forgot' | 'reset';

const TITLE: Record<Mode, string> = {
  login: 'Anmelden',
  invite: 'Willkommen',
  forgot: 'Passwort vergessen',
  reset: 'Neues Passwort',
};

const SUBMIT: Record<Mode, string> = {
  login: 'Anmelden',
  invite: 'Passwort setzen und anmelden',
  forgot: 'Code senden',
  reset: 'Passwort speichern',
};

interface AuthScreenProps {
  /** From an invitation link: the screen opens in `invite` mode for it. */
  inviteToken?: string;
  /** Leaves the invitation, once accepted or given up on. */
  onInviteDone?: () => void;
}

export function AuthScreen({ inviteToken, onInviteDone }: AuthScreenProps) {
  const { status, login, acceptInvitation, notice: logoutNotice } = useAuth();
  const [mode, setMode] = useState<Mode>(inviteToken ? 'invite' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordRepeat, setPasswordRepeat] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [code, setCode] = useState('');
  const [invitation, setInvitation] = useState<InvitationInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(logoutNotice);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!inviteToken) return;
    let cancelled = false;
    lookupInvitation(inviteToken)
      .then((info) => {
        if (cancelled) return;
        setInvitation(info);
        setEmail(info.email);
        setDisplayName(info.displayName ?? '');
      })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof AuthError ? err.message : 'Etwas ist schiefgelaufen.');
      });
    return () => {
      cancelled = true;
    };
  }, [inviteToken]);

  const switchTo = (next: Mode) => {
    setMode(next);
    setError(null);
    setNotice(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (mode === 'invite' && password !== passwordRepeat) {
      setError('Die Passwörter stimmen nicht überein.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'login') await login(email, password);
      else if (mode === 'invite' && inviteToken) {
        await acceptInvitation(inviteToken, password, displayName.trim());
        onInviteDone?.();
      } else if (mode === 'forgot') {
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

  // Until the lookup answers there is no account to show; if it fails, only the way out is left.
  const inviteUnusable = mode === 'invite' && !invitation;

  return (
    <div className={styles.wrap}>
      <div className={styles.eyebrow}>Training</div>
      <h1 className={styles.title}>{TITLE[mode]}</h1>
      {mode === 'invite' && invitation && (
        <p className={styles.sub}>
          Du wurdest zu Training eingeladen. Setz ein Passwort, dann geht&apos;s los.
        </p>
      )}
      {mode === 'forgot' && (
        <p className={styles.sub}>
          Wir schicken dir einen Code, mit dem du ein neues Passwort setzt.
        </p>
      )}
      {mode === 'reset' && (
        <>
          <p className={styles.sub}>
            Falls zu {email} ein Konto existiert, ist ein 6-stelliger Code unterwegs. Er ist 15
            Minuten gültig.
          </p>
          <p className={styles.sub}>Keine E-Mail erhalten? Schau auch im Spam-Ordner nach.</p>
        </>
      )}
      {notice && <p className={styles.sub}>{notice}</p>}

      {inviteUnusable ? (
        error ? (
          <div className={styles.error}>{error}</div>
        ) : (
          <p className={styles.sub}>Einladung wird geladen …</p>
        )
      ) : (
        <form className={styles.form} onSubmit={handleSubmit}>
          <input
            className={styles.input}
            type="email"
            placeholder="E-Mail"
            autoComplete={mode === 'invite' ? 'username' : 'email'}
            autoCapitalize="none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            readOnly={mode === 'invite'}
            required
          />
          {mode === 'invite' && (
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
            <CodeInput
              className={styles.input}
              placeholder="Code"
              value={code}
              onChange={setCode}
            />
          )}
          {mode !== 'forgot' && (
            <input
              className={styles.input}
              type="password"
              placeholder={mode === 'login' ? 'Passwort' : 'Neues Passwort (mind. 8 Zeichen)'}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={mode === 'login' ? undefined : 8}
              required
            />
          )}
          {mode === 'invite' && (
            <input
              className={styles.input}
              type="password"
              placeholder="Passwort wiederholen"
              autoComplete="new-password"
              value={passwordRepeat}
              onChange={(e) => setPasswordRepeat(e.target.value)}
              minLength={8}
              required
            />
          )}

          {error && <div className={styles.error}>{error}</div>}

          <button type="submit" className={styles.solid} disabled={busy}>
            {SUBMIT[mode]}
          </button>
        </form>
      )}

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

      {mode === 'invite' ? (
        <button type="button" className={styles.toggle} onClick={onInviteDone}>
          {status === 'authenticated' ? 'Zurück zur App' : 'Zur Anmeldung'}
        </button>
      ) : (
        mode !== 'login' && (
          <button type="button" className={styles.toggle} onClick={() => switchTo('login')}>
            Zurück zur Anmeldung
          </button>
        )
      )}
    </div>
  );
}
