#!/bin/sh
# Copies the Pi's nightly dumps (deploy/backup.sh) to this Mac and keeps them for KEEP_DAYS, so a
# backup outlives the Pi's SD card. launchd runs it hourly (local.training-tracking.pull-backups.plist);
# away from home the Pi is unreachable and the next run at home catches up, as the Pi keeps 14 dumps.
# Setup in docs/DEPLOY-PI.md.
#
# PI_HOST is a Host entry in ~/.ssh/config whose key the Pi restricts to read-only rrsync on its
# backup directory, so this Mac can fetch the dumps but never change or delete them.
set -eu

PI_HOST=${PI_HOST:?set PI_HOST to the ssh Host of the Pi}
BACKUP_DIR=${BACKUP_DIR:-$HOME/training-backups}
KEEP_DAYS=${KEEP_DAYS:-30}
STALE_DAYS=${STALE_DAYS:-3}
LAST_PULL="$BACKUP_DIR/.last-pull"

mkdir -p "$BACKUP_DIR"

# BatchMode: under launchd there is nobody to answer a password or host key prompt.
if rsync -rt -e 'ssh -o BatchMode=yes -o ConnectTimeout=10' \
  --include='training-*.sql.gz' --exclude='*' "$PI_HOST:" "$BACKUP_DIR/"; then
  touch "$LAST_PULL"
  # Only after a successful pull: weeks away from home must not empty the folder. -t keeps the
  # Pi's timestamps, so age counts from the dump, not from the copy.
  find "$BACKUP_DIR" -name 'training-*.sql.gz' -mtime +"$KEEP_DAYS" -delete
  echo "$(date '+%Y-%m-%d %H:%M:%S') pulled from $PI_HOST"
else
  echo "$(date '+%Y-%m-%d %H:%M:%S') could not pull from $PI_HOST" >&2
fi

if [ -z "$(find "$LAST_PULL" -mtime -"$STALE_DAYS" 2>/dev/null)" ]; then
  osascript -e "display notification \"No backup copied from the Pi for over $STALE_DAYS days.\" with title \"Training backup\""
  exit 1
fi
