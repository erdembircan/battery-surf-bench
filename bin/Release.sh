#!/usr/bin/env bash
#
# Builds a distributable release of the plugin end to end, calling each
# ecosystem's build tooling in turn. Neither ecosystem's own build script
# reaches into the other — this orchestrator is the single caller that knows
# both:
#   1. pnpm run build            — compile the JS/CSS bundles (wp-scripts).
#   2. composer build:container  — validate + flatten/plan the container definitions.
#   3. composer zip              — package the plugin (composer archive ships the
#                                  untracked build/ assets + production vendor/,
#                                  per .gitattributes).
#
# Assumes dependencies are already installed. For a production zip, install
# without dev packages first (`composer install --no-dev --optimize-autoloader`)
# so vendor/ ships lean — that is the release runner's responsibility, not this
# script's.
#
# Run from anywhere; it operates on the repo root.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Building JS/CSS bundles (pnpm)"
pnpm run build

echo "==> Compiling container definitions (composer)"
composer build:container

echo "==> Packaging plugin zip (composer)"
composer zip

echo "==> Release build complete."
