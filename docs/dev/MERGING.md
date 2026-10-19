# Merge rules

These rules apply to every pull request in this repository, whoever opened it.

A pull request is merged only when all of these are true:

1. Every GitHub Actions check on the pull request has passed: Tests (unit, then
   browser and accessibility), CI and i18n-check. A cancelled or skipped run is
   not a pass. Re-run it.
2. GitHub shows no conflicts with the base branch. Conflicts are resolved on the
   pull request branch, never during the merge, and the checks run again.
3. Every review comment (people, Codex, CodeRabbit) is either fixed on the
   branch or answered with the reason it is not a problem. No comment is left
   unanswered.
4. No conflict markers anywhere: `git grep -nE '^(<<<<<<<|>>>>>>>)' -- . ':!node_modules'` prints nothing.
5. The POT files are current: run `bin/make-pot.sh` after changing any
   translatable string and commit the result.
6. The suites pass locally as well: `vendor/bin/phpunit --testsuite unit`,
   `npx jest`, the WordPress suite (`phpunit -c phpunit-wp.xml.dist`),
   `npm run build:all`, and the Playwright specs touched by the change.

Merging is done with the merge button (or the API), never by pushing a local
merge to the base branch. A release branch is merged into `main` only after the
same rules pass on the release branch itself, plus Plugin Check on the built zip.

Commit messages and pull requests carry no AI or tool attribution.
