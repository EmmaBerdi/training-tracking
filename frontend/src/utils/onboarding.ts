/**
 * Whether the introduction has been shown on this device, per account. A UI flag rather than
 * training data, so it stays in localStorage instead of the backend.
 */
const KEY = 'training:onboarded';

function key(email: string): string {
  return `${KEY}:${email}`;
}

export function isOnboarded(email: string): boolean {
  try {
    return localStorage.getItem(key(email)) === '1';
  } catch {
    return false; // private mode / storage disabled: show the introduction, never crash
  }
}

export function markOnboarded(email: string): void {
  try {
    localStorage.setItem(key(email), '1');
  } catch {
    // Not being able to remember is not worth interrupting the user for.
  }
}
