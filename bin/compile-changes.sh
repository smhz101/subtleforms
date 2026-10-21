#!/usr/bin/env bash
# Compile changelog fragments for a release.
#
# Pull requests do not edit readme.txt. Each one adds a single file,
# docs/dev/changes/unreleased/<slug>.md, whose first line is
# "type: Added|Changed|Fixed|Security" (optionally "type: Fixed (Agency)")
# and whose remaining lines are the changelog sentence.
#
# The release pull request runs this script once:
#
#   bin/compile-changes.sh <version> [--date YYYY-MM-DD] [--apply]
#
# Without --apply it only prints the readme.txt changelog block and the
# release notes, and changes nothing. With --apply it also writes
# docs/dev/releases/<version>-changes.md and moves the fragments into
# docs/dev/changes/<version>/. Paste the printed block into readme.txt
# (and changelog.txt where the repository has one) under the version heading.
#
# CHANGES_ROOT overrides the repository root (used by the test).
set -euo pipefail

ROOT="${CHANGES_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
UNRELEASED="$ROOT/docs/dev/changes/unreleased"

die() { echo "compile-changes: $*" >&2; exit 1; }

VERSION=""
DATE="$(date +%F)"
APPLY=0
while [ $# -gt 0 ]; do
	case "$1" in
		--apply) APPLY=1 ;;
		--date) shift; DATE="${1:-}" ;;
		-h|--help) sed -n '2,19p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
		-*) die "unknown option $1" ;;
		*) [ -z "$VERSION" ] || die "one version only"; VERSION="$1" ;;
	esac
	shift
done

[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || die "give a version such as 2.5.0"
[[ "$DATE" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] || die "--date must be YYYY-MM-DD"
[ -d "$UNRELEASED" ] || die "$UNRELEASED does not exist"
if [ "$APPLY" -eq 1 ] && [ -e "$ROOT/docs/dev/changes/$VERSION" ]; then
	die "docs/dev/changes/$VERSION already exists"
fi

EMDASH=$'\xe2\x80\x94'
TAB=$'\t'
ENTRIES=""
FILES=()

# Fragments are read in file name order, so the output is stable.
for f in "$UNRELEASED"/*.md; do
	[ -e "$f" ] || continue
	name="$(basename "$f")"
	first=""
	IFS= read -r first < "$f" || true
	first="${first%$'\r'}"
	re='^type:[[:space:]]*(Added|Changed|Fixed|Security)([[:space:]]*\(([^)]+)\))?[[:space:]]*$'
	[[ "$first" =~ $re ]] || die "$name: first line must be 'type: Added|Changed|Fixed|Security'"
	type="${BASH_REMATCH[1]}"
	scope="${BASH_REMATCH[3]:--}"
	text="$(tail -n +2 "$f" | tr '\r\n' '  ' | sed -E 's/[[:space:]]+/ /g; s/^ //; s/ $//')"
	[ -n "$text" ] || die "$name: no changelog text after the type line"
	case "$text" in *"$EMDASH"*) die "$name: em dashes are not allowed" ;; esac
	case "$text" in "* "*|"- "*) die "$name: write the sentence without a leading bullet" ;; esac
	case "$type" in Added) order=1 ;; Changed) order=2 ;; Fixed) order=3 ;; *) order=4 ;; esac
	ENTRIES+="${order}${TAB}${type}${TAB}${scope}${TAB}${text}"$'\n'
	FILES+=("$f")
done

[ "${#FILES[@]}" -gt 0 ] || die "no fragments in docs/dev/changes/unreleased"

SORTED="$(printf '%s' "$ENTRIES" | sort -s -t "$TAB" -k1,1n)"

README_BLOCK="= $VERSION - $DATE ="$'\n'
NOTES="# Changes in $VERSION"$'\n'
current=""
while IFS="$TAB" read -r order type scope text; do
	case "$type" in Added) label="New" ;; Changed) label="Change" ;; Fixed) label="Fix" ;; *) label="Security" ;; esac
	[ "$scope" = "-" ] || label="$label ($scope)"
	README_BLOCK+="* $label: $text"$'\n'
	if [ "$type" != "$current" ]; then
		NOTES+=$'\n'"## $type"$'\n\n'
		current="$type"
	fi
	if [ "$scope" != "-" ]; then NOTES+="- $scope: $text"$'\n'; else NOTES+="- $text"$'\n'; fi
done <<< "$SORTED"

echo "== readme.txt changelog block =="
printf '%s' "$README_BLOCK"
echo
echo "== docs/dev/releases/$VERSION-changes.md =="
printf '%s' "$NOTES"

if [ "$APPLY" -eq 1 ]; then
	mkdir -p "$ROOT/docs/dev/releases" "$ROOT/docs/dev/changes/$VERSION"
	printf '%s' "$NOTES" > "$ROOT/docs/dev/releases/$VERSION-changes.md"
	for f in "${FILES[@]}"; do
		mv "$f" "$ROOT/docs/dev/changes/$VERSION/"
	done
	echo "compile-changes: wrote docs/dev/releases/$VERSION-changes.md and moved ${#FILES[@]} fragment(s) to docs/dev/changes/$VERSION/" >&2
fi
