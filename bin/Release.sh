#!/usr/bin/env bash
#
# Builds a distributable release of the plugin end to end, calling each
# ecosystem's build tooling in turn. Neither ecosystem's own build script
# reaches into the other — this orchestrator is the single caller that knows
# both:
#   1. pnpm run build              — compile the JS/CSS bundles (wp-scripts).
#   2. composer build:container    — validate + flatten/plan the container definitions.
#   3. composer install --no-dev   — reinstall vendor/ without dev-only packages
#                                    (phpunit, phpcs, mockery, ...) so the zip
#                                    doesn't leak them.
#   4. composer zip                — package the plugin (composer archive ships the
#                                    untracked build/ assets + production vendor/,
#                                    per .gitattributes).
#   5. pnpm package:verify         — check the zip against the package contract in
#                                    bin/PackageRules.mts. --release also requires
#                                    build/ and vendor/, so a leaked file or a
#                                    missing bundle fails the release.
#
# This script installs production dependencies itself before packaging, so the
# resulting zip's vendor/ tree is always lean regardless of what was installed
# beforehand. That leaves your working tree's vendor/ without dev packages
# afterward — run a plain `composer install` again to restore them for
# continued development. That follow-up is the release runner's call, not this
# script's.
#
# Run from anywhere; it operates on the repo root.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Building JS/CSS bundles (pnpm)"
pnpm run build

echo "==> Compiling container definitions (composer)"
composer build:container

echo "==> Installing production dependencies (no dev)"
composer install --no-dev --optimize-autoloader

echo "==> Packaging plugin zip (composer)"
composer zip

echo "==> Verifying package contents (pnpm)"
pnpm package:verify --release

echo "==> Release build complete."
