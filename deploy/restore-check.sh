#!/bin/sh
# Restores a dump from deploy/backup.sh into a throwaway Postgres and counts the main tables: a dump
# only counts as a backup once it has been restored. backup.sh runs this after every dump; it works
# anywhere with Docker, e.g. on a copy on the Mac.
#
#   deploy/restore-check.sh ~/training-backups/training-2026-11-25-0330.sql.gz
set -eu

DUMP=${1:?usage: restore-check.sh <dump.sql.gz>}
# The dump assigns its tables to this role, so it has to exist before the restore.
DB_USER=${DB_USER:-training}
# Same image as deploy/docker-compose.pi.yml, so the dump restores into the Postgres it came from.
IMAGE=postgres:16-alpine
NAME=training-restore-check-$$

# Without pipefail, a truncated file would only show up as a half-restored database.
gunzip -t "$DUMP"

docker run -d --rm --name "$NAME" --network none \
  -e POSTGRES_USER="$DB_USER" -e POSTGRES_PASSWORD=restore-check -e POSTGRES_DB=restore_check \
  "$IMAGE" >/dev/null
trap 'docker rm -f "$NAME" >/dev/null 2>&1 || true' EXIT

# Over TCP: the image's init step runs a temporary server on the socket only, which would answer too
# early.
tries=0
until docker exec "$NAME" pg_isready -q -h 127.0.0.1 -U "$DB_USER" -d restore_check; do
  tries=$((tries + 1))
  if [ "$tries" -ge 60 ]; then
    echo "restore check: Postgres in $NAME did not start" >&2
    exit 1
  fi
  sleep 1
done

if ! gunzip -c "$DUMP" | docker exec -i "$NAME" \
  psql -q -X -v ON_ERROR_STOP=1 --single-transaction -U "$DB_USER" -d restore_check >/dev/null; then
  echo "restore check: $DUMP does not restore" >&2
  exit 1
fi

if ! COUNTS=$(docker exec -i "$NAME" psql -X -At -F= -v ON_ERROR_STOP=1 -U "$DB_USER" -d restore_check <<'SQL'
SELECT 'users', count(*) FROM "user"
UNION ALL SELECT 'days', count(*) FROM day
UNION ALL SELECT 'exercises', count(*) FROM exercise
UNION ALL SELECT 'sessions', count(*) FROM session
UNION ALL SELECT 'images', count(*) FROM exercise_image;
SQL
); then
  echo "restore check: $DUMP restores, but lacks the app's tables" >&2
  exit 1
fi

if echo "$COUNTS" | grep -qx 'users=0'; then
  echo "restore check: $DUMP restores, but holds no users" >&2
  exit 1
fi
echo "restore check passed for $DUMP: $(echo "$COUNTS" | tr '\n' ' ')"
