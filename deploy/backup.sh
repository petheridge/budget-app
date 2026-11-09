#!/bin/bash
# Run nightly from cron: copies pb_data to BACKUP_DEST as a dated archive, keeping the newest BACKUP_KEEP.
# The app stops for the few seconds this takes: copying a live SQLite database can give a corrupt backup.
#
# update.sh also runs it, as "backup.sh pre-update", before starting a new version: migrations change
# the database when the app starts. Those archives are named pre-update-… and the newest
# PRE_UPDATE_KEEP are kept, separately from the nightly ones.
set -euo pipefail
cd "$(dirname "$(readlink -f "$0")")"

mkdir -p logs
exec >>logs/backup.log 2>&1
echo "--- $(date '+%F %T')"
trap 'echo "BACKUP FAILED"' ERR

if [ -f .env ]; then
  set -a
  . ./.env
  set +a
fi
BACKUP_DEST="${BACKUP_DEST:-}"
BACKUP_KEEP="${BACKUP_KEEP:-14}"
PRE_UPDATE_KEEP="${PRE_UPDATE_KEEP:-5}"

case "${1:-nightly}" in
  nightly) PREFIX=pb_data; KEEP="$BACKUP_KEEP"; KEEP_NAME=BACKUP_KEEP ;;
  pre-update) PREFIX=pre-update; KEEP="$PRE_UPDATE_KEEP"; KEEP_NAME=PRE_UPDATE_KEEP ;;
  *) echo "Usage: backup.sh [pre-update]"; false ;;
esac

if ! [[ "$KEEP" =~ ^[1-9][0-9]*$ ]]; then
  echo "$KEEP_NAME must be a whole number of at least 1, got: $KEEP"
  false
fi
if [ ! -d "$BACKUP_DEST" ] || [ ! -d pb_data ]; then
  echo "Missing directory: BACKUP_DEST ($BACKUP_DEST) or pb_data"
  false
fi
# An unmounted NAS leaves a plain folder on the root disk, and backups there would look fine but aren't.
if [ "$(df --output=target "$BACKUP_DEST" | tail -n 1)" = "/" ]; then
  echo "$BACKUP_DEST is on the root disk, so the NAS isn't mounted"
  false
fi

# Stops update.sh restarting the app mid-copy. When update.sh is the caller it already holds the lock.
if [ -z "${DEPLOY_LOCK_HELD:-}" ]; then
  exec 9>.deploy.lock
  flock 9
fi

NAME="$PREFIX-$(date '+%Y%m%d-%H%M%S').tar.gz"
TMP="$BACKUP_DEST/.$NAME.tmp"
trap 'echo "BACKUP FAILED"; rm -f "$TMP"; docker compose start' ERR

docker compose stop
tar -czf "$TMP" pb_data
docker compose start
trap 'echo "BACKUP FAILED"' ERR

# Only a finished archive gets the real name, so pruning can't count a partial one as a good copy.
mv "$TMP" "$BACKUP_DEST/$NAME"
echo "Wrote $BACKUP_DEST/$NAME ($(du -h "$BACKUP_DEST/$NAME" | cut -f1))"

# update.sh warns when this file gets old, so a run of failed backups doesn't go unnoticed.
date '+%F %T' >logs/last-backup-success

find "$BACKUP_DEST" -maxdepth 1 -type f -name "$PREFIX-*.tar.gz" | sort -r \
  | tail -n "+$((KEEP + 1))" | xargs -r rm -v --
