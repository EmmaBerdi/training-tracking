#!/bin/sh
# Redeploys the stack when a new release (a vX.Y.Z tag) has been published. Run every few minutes
# by deploy/training-deploy.timer; does nothing (one git fetch) when there is nothing new. Merges to
# main alone never reach the Pi.
#
# Backs up first: the backend applies pending Liquibase changesets on startup, and a release is all
# it takes to run them against the real database.
set -eu

REPO_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
COMPOSE="docker compose -f $REPO_DIR/deploy/docker-compose.pi.yml --env-file $REPO_DIR/deploy/.env"
# Tracks the tag rather than the commit, so a release on an already checked-out commit still
# rebuilds and bakes its version into the frontend.
DEPLOYED_FILE="$REPO_DIR/deploy/.deployed-version"
# The release notes, baked into the build for the in-app "Neuigkeiten". Public, so no token.
RELEASES_URL="https://api.github.com/repos/EmmaBerdi/training-tracking/releases?per_page=20"
NOTES_FILE="$REPO_DIR/frontend/public/whats-new.json"

# A first-time build can outlast the timer interval; a second run must not start alongside it.
exec 9>"${TMPDIR:-/tmp}/training-auto-deploy.lock"
flock -n 9 || exit 0

git -C "$REPO_DIR" fetch --quiet --tags --force origin
# Plain vX.Y.Z only, so a pre-release tag like v2.0.0-rc1 is never deployed.
NEW=$(git -C "$REPO_DIR" tag -l 'v*' --sort=-v:refname | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | head -n 1)
OLD=$(cat "$DEPLOYED_FILE" 2>/dev/null || true)
[ -z "$NEW" ] || [ "$OLD" = "$NEW" ] && exit 0

# Checking out over local edits would silently discard or mix them in.
if [ -n "$(git -C "$REPO_DIR" status --porcelain)" ]; then
  echo "$(date -Is) not deploying $NEW: local changes in $REPO_DIR" >&2
  exit 1
fi

echo "$(date -Is) deploying $NEW ($(git -C "$REPO_DIR" log --oneline -1 "$NEW"))"
"$REPO_DIR/deploy/backup.sh"
git -C "$REPO_DIR" -c advice.detachedHead=false checkout --quiet "$NEW"
# Recorded before the build: a failing build must not be retried (with a fresh backup) every
# timer run. Fix it with a new patch release instead.
echo "$NEW" > "$DEPLOYED_FILE"
# GitHub being unreachable costs the news, not the deploy.
curl -fsS --max-time 10 -o "$NOTES_FILE" "$RELEASES_URL" || echo '[]' > "$NOTES_FILE"
APP_VERSION=${NEW#v} $COMPOSE up -d --build
# Every rebuild leaves the previous images dangling, a few hundred MB each.
docker image prune -f >/dev/null
echo "$(date -Is) deployed $NEW"
