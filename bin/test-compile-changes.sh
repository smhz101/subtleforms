#!/usr/bin/env bash
# Test for bin/compile-changes.sh. Plain shell, no dependencies.
# Run: bash bin/test-compile-changes.sh
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
SCRIPT="$HERE/compile-changes.sh"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
FAILS=0

ok() { echo "ok   $1"; }
bad() { echo "FAIL $1"; FAILS=$((FAILS + 1)); }
check() { # name, command that must succeed
	local name="$1"; shift
	if "$@" >/dev/null 2>&1; then ok "$name"; else bad "$name"; fi
}

fresh() { # new repo root with an unreleased folder
	rm -rf "$TMP/r"; mkdir -p "$TMP/r/docs/dev/changes/unreleased"
}
frag() { printf '%s\n' "${@:2}" > "$TMP/r/docs/dev/changes/unreleased/$1.md"; }
run() { CHANGES_ROOT="$TMP/r" bash "$SCRIPT" "$@"; }

# Grouping, order, wording and multi-line text.
fresh
frag b-fix 'type: Fixed' 'Saving a form keeps the title.'
frag a-add 'type: Added' '' 'A new export button.' 'It lists every entry.'
frag c-change 'type: Changed' 'The list is faster.'
frag d-sec 'type: Security' 'Webhook secrets are masked.'
frag e-scope 'type: Added (Agency)' 'Branding comes from the account.'
OUT="$(run 2.5.0 --date 2026-11-01)"
EXPECTED='= 2.5.0 - 2026-11-01 =
* New: A new export button. It lists every entry.
* New (Agency): Branding comes from the account.
* Change: The list is faster.
* Fix: Saving a form keeps the title.
* Security: Webhook secrets are masked.'
if [[ "$OUT" == *"$EXPECTED"* ]]; then ok "readme block grouped and ordered"; else bad "readme block grouped and ordered"; echo "$OUT"; fi
[[ "$OUT" == *"## Added"* && "$OUT" == *"## Security"* && "$OUT" == *"- Agency: Branding comes from the account."* ]] && ok "release notes sections" || bad "release notes sections"

# A dry run changes nothing.
check "dry run keeps fragments" test -f "$TMP/r/docs/dev/changes/unreleased/a-add.md"
check "dry run writes no notes" test ! -e "$TMP/r/docs/dev/releases/2.5.0-changes.md"

# Apply moves the fragments and writes the notes.
run 2.5.0 --date 2026-11-01 --apply >/dev/null 2>&1
check "apply moves fragments" test -f "$TMP/r/docs/dev/changes/2.5.0/a-add.md"
check "apply empties unreleased" test -z "$(ls "$TMP/r/docs/dev/changes/unreleased")"
check "apply writes notes" test -f "$TMP/r/docs/dev/releases/2.5.0-changes.md"
check "apply twice is refused" bash -c "! CHANGES_ROOT='$TMP/r' bash '$SCRIPT' 2.5.0 --apply"

# Bad input is refused.
fresh; frag x 'type: Tweaked' 'Something.'
check "unknown type refused" bash -c "! CHANGES_ROOT='$TMP/r' bash '$SCRIPT' 2.5.0"
fresh; frag x 'Fixed: Something.'
check "missing type line refused" bash -c "! CHANGES_ROOT='$TMP/r' bash '$SCRIPT' 2.5.0"
fresh; frag x 'type: Fixed'
check "empty text refused" bash -c "! CHANGES_ROOT='$TMP/r' bash '$SCRIPT' 2.5.0"
fresh; frag x 'type: Fixed' "Dash $(printf '\xe2\x80\x94') here."
check "em dash refused" bash -c "! CHANGES_ROOT='$TMP/r' bash '$SCRIPT' 2.5.0"
fresh
check "no fragments refused" bash -c "! CHANGES_ROOT='$TMP/r' bash '$SCRIPT' 2.5.0"
fresh; frag x 'type: Fixed' 'Something.'
check "bad version refused" bash -c "! CHANGES_ROOT='$TMP/r' bash '$SCRIPT' 2.5"

if [ "$FAILS" -ne 0 ]; then echo "$FAILS failed"; exit 1; fi
echo "all passed"
