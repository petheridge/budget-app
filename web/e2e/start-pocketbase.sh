#!/bin/sh
# Starts a throwaway PocketBase for the end-to-end tests: a fresh database in a
# temporary folder, the real migrations, and the built app (web/dist) as its site.
# Needs the binary from pocketbase/install.sh and a build (npm run build).
set -eu
cd "$(dirname "$0")/../.."
DATA=$(mktemp -d)
trap 'rm -rf "$DATA"' EXIT
./pocketbase/pocketbase superuser create --dir="$DATA" --migrationsDir=pocketbase/pb_migrations \
  e2e-admin@example.com e2e-admin-password >/dev/null
./pocketbase/pocketbase serve --http=127.0.0.1:8091 --dir="$DATA" \
  --migrationsDir=pocketbase/pb_migrations --publicDir=web/dist --automigrate=false
