#!/usr/bin/env bash
#
# Builds a distributable plugin archive at zip/battery-surf-bench.zip.
#
# Composer-native packaging:
#   - assets are compiled fresh (pnpm build),
#   - vendor/ is pruned to production-only dependencies,
#   - `composer archive` packs the working tree, applying the ignore list
#     defined under "archive.exclude" in composer.json,
#   - the flat archive is repacked under a single battery-surf-bench/ root
#     folder so it installs cleanly via the WordPress "Upload Plugin" screen.
#
# The dev dependency set is always restored on exit, so running this never
# leaves the working tree in a production-only state.
set -euo pipefail

SLUG="battery-surf-bench"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST="$ROOT/zip"
STAGE="$(mktemp -d)"

cd "$ROOT"

# Always repackage from scratch and always put the dev dependencies back,
# whether the script succeeds or fails partway through.
cleanup() {
	rm -rf "$STAGE"
	echo "==> Restoring development dependencies"
	composer install --quiet
}
trap cleanup EXIT

echo "==> Building assets"
WP_EXPERIMENTAL_MODULES=true pnpm build

echo "==> Installing production-only dependencies"
composer install --no-dev --optimize-autoloader --quiet

echo "==> Creating composer archive"
composer archive --format=zip --dir="$STAGE" --file="$SLUG-flat" >/dev/null

echo "==> Repacking under $SLUG/ root folder"
mkdir -p "$STAGE/$SLUG"
unzip -q "$STAGE/$SLUG-flat.zip" -d "$STAGE/$SLUG"
mkdir -p "$DIST"
rm -f "$DIST/$SLUG.zip"
( cd "$STAGE" && zip -qr "$DIST/$SLUG.zip" "$SLUG" )

echo "==> Done: zip/$SLUG.zip"
