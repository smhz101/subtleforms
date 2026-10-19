#!/usr/bin/env bash
# Regenerate languages/*.pot exactly as the i18n-check workflow does.
# Run from the plugin root. The folder must be named "subtleforms" (the POT
# header uses the folder name), so this copies the tracked files first.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WP="${WP_CLI:-wp}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
git -C "$ROOT" ls-files -z | (cd "$ROOT" && xargs -0 tar -cf -) | (mkdir -p "$TMP/subtleforms" && tar -xf - -C "$TMP/subtleforms")
( cd "$TMP/subtleforms" && $WP i18n make-pot . languages/subtleforms.pot --exclude="node_modules,vendor,____subtleforms.orig____,build" && $WP i18n make-pot resources languages/subtleforms-js.pot --include="resources" )
cp "$TMP/subtleforms/languages/subtleforms.pot" "$TMP/subtleforms/languages/subtleforms-js.pot" "$ROOT/languages/"
echo "POT files updated."
