# Changelog fragments

Feature and fix pull requests never edit `readme.txt`, `changelog.txt`, the release notes or the version files. Two pull requests that edit the same lines conflict; two pull requests that each add a new file do not. So every pull request that a user can notice adds exactly one new file:

```
docs/dev/changes/unreleased/<short-branch-slug>.md
```

Use the branch name without its prefix, for example `fix-forms-per-page.md` for `fix/forms-per-page`. The file has no frontmatter. The first line is the type, the rest is one plain sentence:

```
type: Fixed
Choosing 50 or 100 rows per page on the Forms screen shows the forms instead of an error.
```

Types: `Added`, `Changed`, `Fixed`, `Security`. They print as `New`, `Change`, `Fix` and `Security` in the readme. A scope is allowed in brackets when the entry only applies to one plan, for example `type: Added (Agency)`.

Rules for the text: plain words, no leading bullet, no em dashes, one change per file. A pull request with no user-visible change (tests, docs, tooling) adds no fragment.

At release time the release pull request runs `bin/compile-changes.sh <version> --apply`. It prints the readme.txt block, writes `docs/dev/releases/<version>-changes.md` and moves the fragments to `docs/dev/changes/<version>/`. See `docs/dev/RELEASING.md`. Entries that were already released are not migrated.

Ledger rows follow the same idea: see `docs/dev/ledger-updates/` and `bin/merge-ledger-updates.sh`. Check the script with `bash bin/test-compile-changes.sh`.
