#!/usr/bin/env bash
# Test for bin/merge-ledger-updates.sh. Plain shell, no dependencies.
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
SCRIPT="$HERE/merge-ledger-updates.sh"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
FAILS=0
ok() { echo "ok   $1"; }
bad() { echo "FAIL $1"; FAILS=$((FAILS + 1)); }

mkdir -p "$TMP/docs/dev/ledger-updates"
printf '%s\n' 'id,status,fixed_in,summary' 'A-1,open,,First' 'A-2,open,,"Has, a comma"' 'A-3,fixed,Free 2.4.0,Third' > "$TMP/docs/dev/bug-ledger.csv"
printf '%s\n' 'A-2,fixed,Free 2.5.0 (#9),"Has, a comma"' > "$TMP/docs/dev/ledger-updates/fix-two.csv"
printf '%s\n' 'B-1,fixed,Free 2.5.0 (#10),New row' 'A-1,fixed,Free 2.5.0 (#10),First' > "$TMP/docs/dev/ledger-updates/other.csv"

CHANGES_ROOT="$TMP" bash "$SCRIPT" >/dev/null 2>&1 || bad "script exits 0"
EXPECTED='id,status,fixed_in,summary
A-1,fixed,Free 2.5.0 (#10),First
A-2,fixed,Free 2.5.0 (#9),"Has, a comma"
A-3,fixed,Free 2.4.0,Third
B-1,fixed,Free 2.5.0 (#10),New row'
[ "$(cat "$TMP/docs/dev/bug-ledger.csv")" = "$EXPECTED" ] && ok "rows replaced in place and new row appended" || { bad "rows replaced in place and new row appended"; cat "$TMP/docs/dev/bug-ledger.csv"; }
[ -z "$(ls "$TMP/docs/dev/ledger-updates")" ] && ok "update files removed" || bad "update files removed"
CHANGES_ROOT="$TMP" bash "$SCRIPT" >/dev/null 2>&1 && ok "no updates is a no-op" || bad "no updates is a no-op"

printf '%s\n' 'id,status,fixed_in,summary' > "$TMP/docs/dev/ledger-updates/h.csv"
CHANGES_ROOT="$TMP" bash "$SCRIPT" >/dev/null 2>&1 && bad "header line refused" || ok "header line refused"

[ "$FAILS" -eq 0 ] && echo "all passed" || { echo "$FAILS failed"; exit 1; }
