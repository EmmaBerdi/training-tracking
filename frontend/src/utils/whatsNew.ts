/**
 * "Neuigkeiten": the GitHub release notes, which deploy/auto-deploy.sh saves as whats-new.json
 * next to the app at deploy time. Which version an account has last seen is a UI flag like
 * onboarding.ts, so it stays in localStorage too.
 */

export interface Release {
  /** Without the "v", e.g. "1.2.0". */
  version: string;
  /** The release name, when it says more than the tag. */
  name: string;
  /** ISO date it was published. */
  date: string;
  notes: string;
}

const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;
const TAG_PATTERN = /^v(\d+\.\d+\.\d+)$/;

/** Where GitHub's generated list of pull requests starts; written for developers, not users. */
const GENERATED_SECTION = /^(##\s+What's Changed|\*\*Full Changelog\*\*)/m;

/** How many releases "Neuigkeiten" in the user menu shows. */
const MENU_RELEASES = 5;

/** The running release, or null for a local or hand-made build that has none. */
export function currentVersion(): string | null {
  const version = import.meta.env.VITE_APP_VERSION;
  return version && VERSION_PATTERN.test(version) ? version : null;
}

/** Orders "1.10.0" after "1.9.3", which comparing the strings would not. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i];
  }
  return 0;
}

/** The part of a release body written for users: everything above GitHub's generated section. */
export function releaseNotes(body: string): string {
  const text = body.replace(/\r\n/g, '\n');
  const cut = text.search(GENERATED_SECTION);
  return (cut === -1 ? text : text.slice(0, cut)).trim();
}

/**
 * The published vX.Y.Z releases from a GitHub releases response that have notes left, newest
 * first. Anything malformed is dropped rather than trusted, since the file comes from outside.
 */
export function parseReleases(json: unknown): Release[] {
  if (!Array.isArray(json)) return [];
  const releases: Release[] = [];
  for (const r of json) {
    if (typeof r !== 'object' || r === null || r.draft || r.prerelease) continue;
    const version = typeof r.tag_name === 'string' ? TAG_PATTERN.exec(r.tag_name)?.[1] : undefined;
    const notes = typeof r.body === 'string' ? releaseNotes(r.body) : '';
    if (!version || !notes) continue;
    const name = typeof r.name === 'string' && r.name !== r.tag_name ? r.name.trim() : '';
    const date = typeof r.published_at === 'string' ? r.published_at.slice(0, 10) : '';
    releases.push({ version, name, date, notes });
  }
  return releases.sort((a, b) => compareVersions(b.version, a.version));
}

/**
 * What to show on opening the app: the releases since the last one seen, up to the running one.
 * An account that has never seen any gets only the newest, an introduction rather than the
 * whole history.
 */
export function unseenReleases(
  releases: Release[],
  lastSeen: string | null,
  current: string,
): Release[] {
  const shipped = releases.filter((r) => compareVersions(r.version, current) <= 0);
  if (lastSeen === null) return shipped.slice(0, 1);
  return shipped.filter((r) => compareVersions(r.version, lastSeen) > 0);
}

/** The releases "Neuigkeiten" in the user menu shows, seen or not. */
export function recentReleases(releases: Release[], current: string | null): Release[] {
  const shipped = current
    ? releases.filter((r) => compareVersions(r.version, current) <= 0)
    : releases;
  return shipped.slice(0, MENU_RELEASES);
}

/** The release notes this build was deployed with; none when the file is missing or broken. */
export async function loadReleases(): Promise<Release[]> {
  try {
    // Revalidated each time: a deploy replaces the file under the same name.
    const res = await fetch(`${import.meta.env.BASE_URL}whats-new.json`, { cache: 'no-cache' });
    return res.ok ? parseReleases(await res.json()) : [];
  } catch {
    return [];
  }
}

const KEY = 'training:whatsNewSeen';

function key(email: string): string {
  return `${KEY}:${email}`;
}

export function lastSeenVersion(email: string): string | null {
  try {
    return localStorage.getItem(key(email));
  } catch {
    return null;
  }
}

export function markSeen(email: string, version: string): void {
  try {
    localStorage.setItem(key(email), version);
  } catch {
    // Not being able to remember is not worth interrupting the user for.
  }
}
