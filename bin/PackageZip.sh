#!/usr/bin/env bash
#
# Packages the plugin into zip/battery-surf-bench.zip, with every file inside
# one top-level battery-surf-bench/ folder. `composer zip` runs this script, and
# bin/Release.sh runs `composer zip` for every release build.
#
# The folder decides where a manual install puts the plugin. Since WordPress
# 7.1.4, a zip is unpacked into a working folder with a random suffix, and a
# zip without one top-level folder is installed under that working folder's
# name. Through wp-admin's Upload Plugin or `wp plugin install`, a zip with its
# files at the root therefore lands in a folder such as
# wp-content/plugins/battery-surf-bench-NjGnIJJw2F9dyaOi/, which WordPress.org
# updates for battery-surf-bench/battery-surf-bench.php never reach.
#
# composer archive picks the files: everything the .gitattributes export-ignore
# rules leave in, including the untracked build/ assets and vendor/ tree. It
# can't put them inside a folder, so this script archives to a staging folder,
# unpacks that archive into battery-surf-bench/, and zips the folder. zip and
# unzip ship with macOS and the GitHub Actions Ubuntu runners.
#
# Run from anywhere; it operates on the repo root.
set -euo pipefail

cd "$(dirname "$0")/.."

slug=battery-surf-bench
zip_path="$PWD/zip/$slug.zip"
stage="$(mktemp -d)"
trap 'rm -rf "$stage"' EXIT

# --quiet keeps composer from reporting the staging archive, which is deleted
# on exit. Errors still print.
composer archive --quiet --format=zip --dir="$stage" --file="$slug"
unzip -q "$stage/$slug.zip" -d "$stage/$slug"

# zip adds to an existing archive instead of replacing it, so remove the old
# one first, or files deleted since the last build would still ship.
mkdir -p zip
rm -f "$zip_path"

# -D leaves out folder entries, as composer archive does, and -X leaves out
# Unix file attributes such as the owner.
(cd "$stage" && zip -qrXD "$zip_path" "$slug")

echo "Packaged the plugin in $slug/: $zip_path"
