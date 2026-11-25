import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminUser } from '../../api/admin';
import { invitationValidUntil, userSummary } from './userStatus';

// Midday UTC throughout, so the dates come out the same in any time zone the test runs in.
const NOW = '2026-11-20T12:00:00Z';

function user(overrides: Partial<AdminUser>): AdminUser {
  return {
    id: 1,
    email: 'jonas@example.com',
    displayName: null,
    status: 'active',
    admin: false,
    createdAt: '2026-11-01T12:00:00Z',
    lastLoginAt: null,
    invitationExpiresAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(NOW));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('invitationValidUntil', () => {
  it('gives the expiry while the link still works', () => {
    const expiresAt = '2026-11-22T12:00:00Z';
    expect(invitationValidUntil(user({ invitationExpiresAt: expiresAt }))).toBe(expiresAt);
  });

  it('gives nothing once the link has run out, or without one', () => {
    expect(invitationValidUntil(user({ invitationExpiresAt: '2026-11-19T12:00:00Z' }))).toBeNull();
    expect(invitationValidUntil(user({ invitationExpiresAt: null }))).toBeNull();
  });
});

describe('userSummary', () => {
  it('shows how long an invitation is still good for', () => {
    const invited = user({ status: 'invited', invitationExpiresAt: '2026-11-22T12:00:00Z' });
    expect(userSummary(invited)).toBe('Eingeladen · gültig bis 22.11.2026');
  });

  it('says when an invitation link has expired', () => {
    const invited = user({ status: 'invited', invitationExpiresAt: '2026-11-19T12:00:00Z' });
    expect(userSummary(invited)).toBe('Eingeladen · Link abgelaufen');
  });

  it('joins name, status and last login, leaving out what is missing', () => {
    expect(userSummary(user({ displayName: 'Jonas', lastLoginAt: '2026-11-18T12:00:00Z' }))).toBe(
      'Jonas · Aktiv · zuletzt 18.11.2026',
    );
    expect(userSummary(user({ status: 'deactivated' }))).toBe('Deaktiviert');
  });
});
