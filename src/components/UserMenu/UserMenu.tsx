import { useEffect, useRef, useState } from 'react';
import styles from './UserMenu.module.scss';

interface UserMenuProps {
  email: string;
  onReopenIntro: () => void;
  onLogout: () => void;
}

export function UserMenu({ email, onReopenIntro, onLogout }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // A popover has no backdrop to tap, so closing has to come from the document itself.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const run = (action: () => void) => () => {
    setOpen(false);
    action();
  };

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.avatar}
        aria-label="Konto"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <circle cx="12" cy="8.5" r="3.75" />
          <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
        </svg>
      </button>

      {open && (
        <div className={styles.menu} role="menu">
          <div className={styles.email}>{email}</div>
          <button
            type="button"
            role="menuitem"
            className={styles.item}
            onClick={run(onReopenIntro)}
          >
            Einführung nochmal ansehen
          </button>
          <button type="button" role="menuitem" className={styles.item} onClick={run(onLogout)}>
            Abmelden
          </button>
        </div>
      )}
    </div>
  );
}
