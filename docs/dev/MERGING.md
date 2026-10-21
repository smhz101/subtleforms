# Merge rules

These rules apply to every pull request in this repository, whoever opened it.

A pull request is merged only when all of these are true:

1. Every GitHub Actions check on the pull request has passed: Tests (unit, and
   browser and accessibility, which run side by side), CI and i18n-check. A
   cancelled or skipped run is not a pass. Re-run it. The list of required check
   names is in docs/dev/BRANCH_PROTECTION.md.
2. GitHub shows no conflicts with the base branch. Conflicts are resolved on the
   pull request branch, never during the merge, and the checks run again.
3. Every review comment (people, Codex, CodeRabbit) is either fixed on the
   branch or answered with the reason it is not a problem. No comment is left
   unanswered.
4. No conflict markers anywhere: `git grep -nE '^(<<<<<<<|>>>>>>>)' -- . ':!node_modules'` prints nothing.
5. The POT files are current, for release pull requests only (`release/*`, the only place the freshness check fails):
   `bin/make-pot.sh` is the last commit of the release. Feature and fix pull
   requests do not commit POT files and do not edit `readme.txt`, the
   changelog, release notes or version files; they add one changelog fragment
   in `docs/dev/changes/unreleased/` instead.
6. The suites pass locally as well: `vendor/bin/phpunit --testsuite unit`,
   `npx jest`, the WordPress suite (`phpunit -c phpunit-wp.xml.dist`),
   `npm run build:all`, and the Playwright specs touched by the change.

Release order: merge every feature and fix pull request first. Then one
release pull request bumps the version, runs `bin/merge-ledger-updates.sh`
(bug-ledger.csv rows come from `docs/dev/ledger-updates/*.csv`), runs `bin/compile-changes.sh <version>
--apply` (readme.txt and changelog.txt block, release notes, fragments moved),
regenerates the POT as its last step and is merged and tagged last. Commands:
docs/dev/RELEASING.md.

Merging is done with the merge button (or the API), never by pushing a local
merge to the base branch. A release branch is merged into `main` only after the
same rules pass on the release branch itself, plus Plugin Check on the built zip.

Commit messages and pull requests carry no AI or tool attribution.
