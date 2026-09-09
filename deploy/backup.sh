#!/bin/sh
# Nightly pg_dump into BACKUP_DIR, keeping the last 14. The exported JSON in the app covers the
# training data; this covers accounts, refresh tokens and the exercise photos as well.
#
#   crontab -e
#   30 3 * * * /home/pi/Training_tracking/deploy/backup.sh >> /home/pi/backup.log 2>&1
set -eu

REPO_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
BACKUP_DIR=${BACKUP_DIR:-$HOME/training-backups}
KEEP=${KEEP:-14}

. "$REPO_DIR/deploy/.env"

mkdir -p "$BACKUP_DIR"
STAMP=$(date +%Y-%m-%d)
OUT="$BACKUP_DIR/training-$STAMP.sql.gz"

docker compose -f "$REPO_DIR/deploy/docker-compose.pi.yml" --env-file "$REPO_DIR/deploy/.env" \
  exec -T postgres pg_dump -U "${DB_USER:-training}" "${DB_NAME:-training_tracking}" | gzip > "$OUT"

# Only prune once the new dump exists, so a failed run never costs you the old ones.
ls -1t "$BACKUP_DIR"/training-*.sql.gz | tail -n +$((KEEP + 1)) | xargs -r rm --
echo "$(date -Is) backed up to $OUT"
