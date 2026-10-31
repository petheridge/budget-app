#!/bin/bash
# Run from cron: pulls the image and restarts the app only if it changed.
set -uo pipefail
cd "$(dirname "$(readlink -f "$0")")" || exit 1

mkdir -p logs
LOG=logs/update.log
exec >>"$LOG" 2>&1

# Shared with backup.sh, whose copy would be disturbed by a restart. Try again on the next run.
exec 9>.deploy.lock
flock -n 9 || exit 0

echo "--- $(date '+%F %T')"
if docker compose pull -q && docker compose up -d; then
  # Old versions pile up otherwise. Pinning a SHA pulls it again from GHCR.
  docker image prune -f >/dev/null
else
  echo "UPDATE FAILED"
fi

# Cron adds to this every 5 minutes, so keep only the recent part.
tail -n 2000 "$LOG" >"$LOG.tmp" && cat "$LOG.tmp" >"$LOG"
rm -f "$LOG.tmp"
