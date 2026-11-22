import { describe, expect, it } from 'vitest';
import {
  compareVersions,
  parseReleases,
  recentReleases,
  releaseNotes,
  unseenReleases,
  type Release,
} from './whatsNew';

const release = (version: string): Release => ({ version, name: '', date: '', notes: 'x' });

describe('compareVersions', () => {
  it('compares each part as a number', () => {
    expect(compareVersions('1.10.0', '1.9.3')).toBeGreaterThan(0);
    expect(compareVersions('1.2.3', '2.0.0')).toBeLessThan(0);
    expect(compareVersions('1.2.3', '1.2.3')).toBe(0);
  });
});

describe('releaseNotes', () => {
  it("cuts GitHub's generated pull request list", () => {
    const body =
      "## Neu\r\n- Neuigkeiten\r\n\r\n## What's Changed\r\n* feat: x by @someone in #7\r\n\r\n**Full Changelog**: v1.0.0...v1.1.0";
    expect(releaseNotes(body)).toBe('## Neu\n- Neuigkeiten');
  });

  it('cuts at "Full Changelog" when there is no list', () => {
    expect(releaseNotes('Kleiner Fix\n\n**Full Changelog**: v1.1.0...v1.1.1')).toBe('Kleiner Fix');
  });

  it('is empty when there are only generated notes', () => {
    expect(releaseNotes("## What's Changed\n* fix: y")).toBe('');
  });
});

describe('parseReleases', () => {
  it('keeps published vX.Y.Z releases with notes, newest first', () => {
    const json = [
      { tag_name: 'v1.9.0', name: 'v1.9.0', body: 'Neun', published_at: '2026-11-01T10:00:00Z' },
      {
        tag_name: 'v1.10.0',
        name: 'Statistik',
        body: 'Zehn',
        published_at: '2026-11-20T10:00:00Z',
      },
    ];
    expect(parseReleases(json)).toEqual([
      { version: '1.10.0', name: 'Statistik', date: '2026-11-20', notes: 'Zehn' },
      { version: '1.9.0', name: '', date: '2026-11-01', notes: 'Neun' },
    ]);
  });

  it('drops drafts, pre-releases, other tags and releases without notes', () => {
    const json = [
      { tag_name: 'v2.0.0', body: 'Entwurf', draft: true },
      { tag_name: 'v2.0.0-rc1', body: 'Vorab' },
      { tag_name: 'v1.9.0', body: 'Vorab', prerelease: true },
      { tag_name: 'nightly', body: 'Nacht' },
      { tag_name: 'v1.8.1', body: "## What's Changed\n* fix: z" },
      { tag_name: 'v1.8.0', body: null },
      'kaputt',
      null,
    ];
    expect(parseReleases(json)).toEqual([]);
  });

  it('accepts nothing but a list', () => {
    expect(parseReleases({ message: 'API rate limit exceeded' })).toEqual([]);
    expect(parseReleases(null)).toEqual([]);
  });
});

describe('unseenReleases', () => {
  const releases = [release('1.3.0'), release('1.2.0'), release('1.1.0')];

  it('shows the releases since the last one seen', () => {
    expect(unseenReleases(releases, '1.1.0', '1.3.0').map((r) => r.version)).toEqual([
      '1.3.0',
      '1.2.0',
    ]);
  });

  it('shows nothing once the running release is seen', () => {
    expect(unseenReleases(releases, '1.3.0', '1.3.0')).toEqual([]);
  });

  it('never shows a release newer than the running one', () => {
    expect(unseenReleases(releases, '1.1.0', '1.2.0').map((r) => r.version)).toEqual(['1.2.0']);
  });

  it('introduces only the newest release to an account that has seen none', () => {
    expect(unseenReleases(releases, null, '1.2.5').map((r) => r.version)).toEqual(['1.2.0']);
  });
});

describe('recentReleases', () => {
  const releases = ['1.6.0', '1.5.0', '1.4.0', '1.3.0', '1.2.0', '1.1.0'].map(release);

  it('shows the last few shipped releases', () => {
    expect(recentReleases(releases, '1.5.0').map((r) => r.version)).toEqual([
      '1.5.0',
      '1.4.0',
      '1.3.0',
      '1.2.0',
      '1.1.0',
    ]);
  });

  it('shows the newest when the running version is unknown', () => {
    expect(recentReleases(releases, null)[0].version).toBe('1.6.0');
  });
});
