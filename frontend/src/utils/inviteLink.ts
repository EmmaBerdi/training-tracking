/**
 * The token from an invitation link, `<app>/#invite=<token>`. A fragment, so the browser never sends
 * it to the server and it stays out of access logs.
 */
export function readInviteToken(hash: string): string | null {
  const token = new URLSearchParams(hash.replace(/^#/, '')).get('invite');
  return token?.trim() || null;
}
