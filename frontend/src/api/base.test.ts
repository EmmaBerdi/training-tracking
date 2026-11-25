import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API_FAILURE, NO_CONTENT, call, request, requestOk } from './base';

vi.mock('../auth/tokenStore', () => ({
  getAccessToken: () => 'access',
  getRefreshToken: () => 'refresh',
  setTokens: vi.fn(),
  clearTokens: vi.fn(),
}));

vi.mock('../auth/authClient', () => ({
  refresh: vi.fn(async () => ({ accessToken: 'new-access', refreshToken: 'new-refresh' })),
}));

const fetchMock = vi.fn<typeof fetch>();

function answer(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), { status });
}

beforeEach(() => {
  vi.stubGlobal('window', {});
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

describe('call', () => {
  it('decodes a successful answer', async () => {
    fetchMock.mockResolvedValue(answer(200, { id: 1 }));

    expect(await call('/timers/1')).toEqual({ ok: true, data: { id: 1 } });
  });

  it.each([204, 202])('returns NO_CONTENT for a %i without a body', async (status) => {
    fetchMock.mockResolvedValue(answer(status));

    expect(await call('/account/email/request', { method: 'POST' })).toEqual({
      ok: true,
      data: NO_CONTENT,
    });
  });

  it.each([
    [400, API_FAILURE.invalid],
    [409, API_FAILURE.conflict],
    [429, API_FAILURE.rateLimited],
    [404, API_FAILURE.server],
    [500, API_FAILURE.server],
  ])('sorts a %i into %s', async (status, kind) => {
    fetchMock.mockResolvedValue(answer(status));

    expect(await call('/state', { method: 'PUT', body: {} })).toEqual({ ok: false, kind, status });
  });

  it('reports offline when no answer arrives', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    expect(await call('/state')).toEqual({ ok: false, kind: API_FAILURE.offline });
  });

  it('reports a server failure for a body that is not JSON', async () => {
    fetchMock.mockResolvedValue(new Response('<html>', { status: 200 }));

    expect(await call('/state')).toEqual({ ok: false, kind: API_FAILURE.server, status: 200 });
  });

  it('retries once with a refreshed token after a 401', async () => {
    fetchMock.mockResolvedValueOnce(answer(401)).mockResolvedValueOnce(answer(200, []));

    expect(await call('/timers')).toEqual({ ok: true, data: [] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const retried = new Headers(fetchMock.mock.calls[1][1]?.headers);
    expect(retried.get('Authorization')).toBe('Bearer new-access');
  });

  it('reports auth when the retry is still refused', async () => {
    fetchMock.mockResolvedValue(answer(401));

    expect(await call('/timers')).toEqual({ ok: false, kind: API_FAILURE.auth, status: 401 });
  });
});

describe('request and requestOk', () => {
  it('fold every failure into null and false', async () => {
    fetchMock.mockResolvedValue(answer(409));

    expect(await request('/state')).toBeNull();
    expect(await requestOk('/state', { method: 'PUT', body: {} })).toBe(false);
  });

  it('pass a success through', async () => {
    fetchMock.mockResolvedValueOnce(answer(200, { a: 1 })).mockResolvedValueOnce(answer(204));

    expect(await request('/state')).toEqual({ a: 1 });
    expect(await requestOk('/timers/1', { method: 'DELETE' })).toBe(true);
  });
});
