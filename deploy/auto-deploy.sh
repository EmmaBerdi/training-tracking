#!/bin/sh
# Redeploys the stack when origin/main has moved. Run every few minutes by
# deploy/training-deploy.timer; does nothing (one git fetch) when there is nothing new.
#
# Backs up first: the backend applies pending Liquibase changesets on startup, and a merge to
# main is all it takes to run them against the real database.
set -eu

REPO_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
COMPOSE="docker compose -f $REPO_DIR/deploy/docker-compose.pi.yml --env-file $REPO_DIR/deploy/.env"

# A first-time build can outlast the timer interval; a second run must not start alongside it.
exec 9>"${TMPDIR:-/tmp}/training-auto-deploy.lock"
flock -n 9 || exit 0

git -C "$REPO_DIR" fetch --quiet origin main
OLD=$(git -C "$REPO_DIR" rev-parse HEAD)
NEW=$(git -C "$REPO_DIR" rev-parse origin/main)
[ "$OLD" = "$NEW" ] && exit 0

echo "$(date -Is) deploying $(git -C "$REPO_DIR" log --oneline -1 origin/main)"
"$REPO_DIR/deploy/backup.sh"
# --ff-only refuses rather than merging over local edits on the Pi.
git -C "$REPO_DIR" merge --ff-only --quiet origin/main
$COMPOSE up -d --build
# Every rebuild leaves the previous images dangling, a few hundred MB each.
docker image prune -f >/dev/null
echo "$(date -Is) deployed $NEW"
