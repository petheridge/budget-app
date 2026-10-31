#!/bin/sh
# Downloads the PocketBase binary for local development, next to this script.
# Keep VERSION in step with PB_VERSION in the Dockerfile.
set -eu

VERSION=0.40.6

case "$(uname -m)" in
  x86_64) ARCH=amd64 ;;
  aarch64 | arm64) ARCH=arm64 ;;
  *) echo "Unsupported architecture: $(uname -m)" >&2; exit 1 ;;
esac
case "$(uname -s)" in
  Linux) OS=linux ;;
  Darwin) OS=darwin ;;
  *) echo "Unsupported OS: $(uname -s)" >&2; exit 1 ;;
esac

cd "$(dirname "$0")"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

ZIP="pocketbase_${VERSION}_${OS}_${ARCH}.zip"
BASE="https://github.com/pocketbase/pocketbase/releases/download/v${VERSION}"
curl -fsSL -o "$TMP/$ZIP" "$BASE/$ZIP"
curl -fsSL -o "$TMP/checksums.txt" "$BASE/checksums.txt"
(cd "$TMP" && grep " $ZIP\$" checksums.txt | sha256sum -c -)
python3 -c "import sys, zipfile; zipfile.ZipFile(sys.argv[1]).extract('pocketbase', '.')" "$TMP/$ZIP"
chmod +x pocketbase
./pocketbase --version
