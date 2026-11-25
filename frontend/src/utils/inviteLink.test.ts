import { describe, expect, it } from 'vitest';
import { readInviteToken } from './inviteLink';

describe('readInviteToken', () => {
  it('reads the token the backend puts in the link', () => {
    expect(readInviteToken('#invite=Qx7v-k2Rw_9a')).toBe('Qx7v-k2Rw_9a');
  });

  it('decodes a token a mail client percent-encoded', () => {
    expect(readInviteToken('#invite=abc%2Ddef')).toBe('abc-def');
  });

  it('finds nothing in an empty or unrelated fragment', () => {
    expect(readInviteToken('')).toBeNull();
    expect(readInviteToken('#')).toBeNull();
    expect(readInviteToken('#section=2')).toBeNull();
    expect(readInviteToken('#invite=')).toBeNull();
  });
});
