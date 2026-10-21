#!/usr/bin/env bash
# Merge the ledger update files of a release into docs/dev/bug-ledger.csv.
#
# A pull request that fixes or reopens a bug adds ONE new file,
# docs/dev/ledger-updates/<slug>.csv, holding the full replacement row for
# each bug ID: same columns as bug-ledger.csv, no header line. It never edits
# bug-ledger.csv itself, so two pull requests never conflict on it.
#
# The release pull request runs this script once. A row whose ID is already in
# the ledger replaces that row in place; a new ID is appended. The merged update
# files are then deleted. If two files carry the same ID, the later file name
# wins.
#
# CHANGES_ROOT overrides the repository root (used by the test).
set -euo pipefail

ROOT="${CHANGES_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
LEDGER="$ROOT/docs/dev/bug-ledger.csv"
DIR="$ROOT/docs/dev/ledger-updates"

[ -f "$LEDGER" ] || { echo "merge-ledger-updates: $LEDGER not found" >&2; exit 1; }
FILES=()
for f in "$DIR"/*.csv; do [ -e "$f" ] && FILES+=("$f"); done
if [ "${#FILES[@]}" -eq 0 ]; then echo "merge-ledger-updates: no update files"; exit 0; fi

UPDATES="$(mktemp)"
OUT="$(mktemp)"
trap 'rm -f "$UPDATES" "$OUT"' EXIT
for f in "${FILES[@]}"; do
	tr -d '\r' < "$f" | sed '/^[[:space:]]*$/d' >> "$UPDATES"
done
if grep -q $'\xe2\x80\x94' "$UPDATES"; then echo "merge-ledger-updates: em dashes are not allowed" >&2; exit 1; fi
if grep -q '^id,' "$UPDATES"; then echo "merge-ledger-updates: update files must not carry the header line" >&2; exit 1; fi

# IDs have no commas, so the ID is everything before the first comma.
awk -F, '
	NR == FNR { id = $1; if (!(id in row)) order[++n] = id; row[id] = $0; next }
	FNR == 1 { print; next }
	{ if ($1 in row) { print row[$1]; used[$1] = 1 } else print }
	END { for (i = 1; i <= n; i++) if (!(order[i] in used)) print row[order[i]] }
' "$UPDATES" "$LEDGER" > "$OUT"

cat "$OUT" > "$LEDGER"
rm -f "${FILES[@]}"
echo "merge-ledger-updates: merged ${#FILES[@]} file(s) into docs/dev/bug-ledger.csv"
