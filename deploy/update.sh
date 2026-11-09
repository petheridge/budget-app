#!/bin/bash
# Run from cron: pulls the image and restarts the app only if it changed. Before starting a
# new version it backs up pb_data (backup.sh pre-update), because migrations change the
# database on startup; if that backup fails, the old version keeps running.
set -uo pipefail
cd "$(dirname "$(readlink -f "$0")")" || exit 1

mkdir -p logs
LOG=logs/update.log
exec >>"$LOG" 2>&1

# Shared with backup.sh, whose copy would be disturbed by a restart. Try again on the next run.
exec 9>.deploy.lock
flock -n 9 || exit 0

echo "--- $(date '+%F %T')"

# Backup failures only show in logs/backup.log, so say so here too once they've gone on a while.
if [ -d pb_data ] && [ -z "$(find logs/last-backup-success -mmin -2880 2>/dev/null)" ]; then
  echo "WARNING: no successful backup in the last 48 hours. See logs/backup.log"
fi

# The image the app is running now, and the one just pulled. Empty when there isn't one.
running_image() {
  local id
  id=$(docker compose ps -q budget 2>/dev/null | head -n 1)
  [ -n "$id" ] && docker inspect -f '{{.Image}}' "$id" 2>/dev/null
}
pulled_image() {
  docker image inspect -f '{{.Id}}' "$(docker compose config --images | head -n 1)" 2>/dev/null
}

if ! docker compose pull -q; then
  echo "UPDATE FAILED"
else
  RUNNING=$(running_image)
  PULLED=$(pulled_image)
  # A first install has nothing running and nothing worth backing up.
  if [ -n "$RUNNING" ] && [ -n "$PULLED" ] && [ "$RUNNING" != "$PULLED" ] \
    && ! DEPLOY_LOCK_HELD=1 ./backup.sh pre-update; then
    echo "UPDATE SKIPPED: the backup before it failed. See logs/backup.log"
  elif docker compose up -d; then
    # Old versions pile up otherwise. Pinning a SHA pulls it again from GHCR.
    docker image prune -f >/dev/null
  else
    echo "UPDATE FAILED"
  fi
fi

# Cron adds to this every 5 minutes, so keep only the recent part.
tail -n 2000 "$LOG" >"$LOG.tmp" && cat "$LOG.tmp" >"$LOG"
rm -f "$LOG.tmp"
