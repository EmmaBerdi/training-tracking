import type { CSSProperties } from 'react';
import type { BlockKind, SessionType } from '../types';

/** The name of the custom property every accent-aware component reads its highlight from. */
const ACCENT = '--k';

function accent(value: string): CSSProperties {
  return { [ACCENT]: value } as CSSProperties;
}

/** The accent color a block's chrome reads from. */
export function blockAccent(kind: BlockKind): CSSProperties {
  return accent(`var(--${kind})`);
}

/** A session type's own color, or the neutral one for a type without (or one since deleted). */
export function sessionTypeColor(type: SessionType | undefined): string {
  return type?.color || 'var(--faint)';
}

/** The accent color a session type's chip/pill chrome reads from. */
export function sessionTypeAccent(type: SessionType | undefined): CSSProperties {
  return accent(sessionTypeColor(type));
}

/** An accent taken straight from a stored color, for a tab whose type is already resolved. */
export function colorAccent(color: string): CSSProperties {
  return accent(color);
}

/**
 * The default color offered when creating a session type, read from the stylesheet so the palette
 * stays defined in exactly one place (`styles/global.scss`).
 */
export function defaultSessionTypeColor(): string {
  const token = getComputedStyle(document.documentElement).getPropertyValue('--skill').trim();
  return token || '#5b9bc9';
}
