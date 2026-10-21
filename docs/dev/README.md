# How the 2.3.9 to 2.6 work is organised

- `bug-ledger.csv`: every known bug (266: 158 from the 2.3.3 audit, 108 from the 2.3.8 audit) with its release, package, owner, `status` (`fixed`, `fixed-no-test`, `partly` or `open`), `fixed_in` (the pull request and release) and a `note` for anything still missing. A release is done when every ID in it is fixed with a test.
- `packages/<ID>.md`: one work order each, with every bug's repro, expected result, actual result and likely cause. The "Still open" labels in those files are the state at the 2.3.8 audit, not today. The ledger is the current state.
- `qa/2.3.3/` and `qa/2.3.8/`: the full audit reports, for detail only.
- `wporg-readme.txt`: the validated readme draft for the WordPress.org submission.
- `RULES.md`: standing rules for every change: branches, commits, tests, what "done" means.
- `MERGING.md`: what a pull request needs before it is merged.
- `changes/`: changelog fragments, one new file per pull request (`changes/README.md`). `RELEASING.md`: the release pull request, in order. `ledger-updates/`: one CSV of replacement ledger rows per pull request, merged into `bug-ledger.csv` at release.

Flow: release branch `release/<version>` from main. Each package on `pkg/<ID>` from the release branch, pull request back into it. The release branch gets the full suites (PHPUnit unit and WP, Jest, Playwright with axe, Plugin Check) on a clean site, then it is merged to main, tagged, and the zips are built.

Before starting a package, read its rows in `bug-ledger.csv`. Do not redo a bug marked `fixed`; check `fixed_in` first. A bug marked `fixed-no-test` has its fix in place: do not rewrite it, add only the missing regression test and set the status to `fixed`. `partly` and `open` rows are real work; the `note` says what is missing. When a bug is fixed, update its row in the same pull request.

This folder is for development only and is excluded from the plugin zip and from SVN.
