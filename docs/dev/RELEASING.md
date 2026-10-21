# Releasing SubtleForms (Free)

The release is one pull request, `release/<version>`, opened after every feature and fix pull request for that version is merged. It is the only pull request that touches `readme.txt`, `changelog.txt`, the version files and the POT files, so those files stop conflicting.

## Order

1. Merge every feature and fix pull request into `main`. Each one carries its changelog fragment in `docs/dev/changes/unreleased/` and none of them edits the readme, the versions or the POT.
2. Branch from `main`: `git switch -c release/<version> origin/main`.
3. Bump the version: `Version:` and `SUBTLEFORMS_VERSION` in `subtleforms.php`, `version` in `package.json`, `Stable tag:` in `readme.txt`. Check `Tested up to`, `Requires at least` and `Requires PHP`.
4. Compile the changelog: `bin/compile-changes.sh <version> --apply`. Paste the printed block into `readme.txt` and `changelog.txt` under `== Changelog ==`. If a `= Unreleased =` heading from before this flow is still there, replace the heading with the version heading and keep its lines in the same block. `readme.txt` lists only the latest versions; `changelog.txt` keeps all of them. Add an upgrade notice if users must act.
5. Regenerate the POT as the last edit, after all strings are final:
   ```
   WP_CLI=wp bin/make-pot.sh
   ```
   In the agent environment, where WP-CLI runs offline: `WP_CLI="env I18N_OFFLINE=1 php /tmp/claude-0/wp-cli-latest-offline.phar --allow-root" bin/make-pot.sh`. The checkout folder must be named `subtleforms`. Commit `languages/subtleforms.pot` and `languages/subtleforms-js.pot`.
6. Open the pull request from `release/<version>` into `main`. The `POT freshness check` job fails a stale POT only for this pull request and for pushes to `main`; feature pull requests only get a warning.
7. When every check is green and `docs/dev/MERGING.md` is satisfied, merge, tag `main` as `v<version>` and follow `RELEASE.md` for WordPress.org.

## Why the POT is not in every pull request

The POT lists every string with its source line, so any two pull requests that touch PHP or JS near each other change the same lines of the POT and conflict. Regenerating it once per release removes that. Feature pull requests still prove that strings extract cleanly (the extraction step must succeed), they just do not have to commit the result.

## Why there is no merge driver for the POT

`.gitattributes` marks `languages/*.pot` as `-diff linguist-generated` so it collapses in review. It deliberately has no `merge=union`: a union merge keeps both sides of a conflicting hunk, which produces duplicate `msgid` entries and duplicate header lines, and such a file is invalid. If a POT ever conflicts, take either side and run the command in step 5.
