# How the 2.3.9 to 2.6 work is organised

- `bug-ledger.csv`: every known bug (266: 158 from the 2.3.3 audit, 108 from the 2.3.8 audit) with its release, package and owner. A release is done when every ID in it is fixed with a test.
- `packages/<ID>.md`: one work order each, with every bug's repro, expected result, actual result and likely cause. A package is the unit of work for one person or one AI session.
- `qa/2.3.3/` and `qa/2.3.8/`: the full audit reports, for detail only.
- `wporg-readme.txt`: the validated readme draft for the WordPress.org submission.
- `.cursor/rules/subtleforms.mdc` (repo root): standing rules every session follows.

Flow: release branch `release/<version>` from main. Each package on `pkg/<ID>` from the release branch, pull request back into it. Claude integrates the release branch, runs the full suites (PHPUnit unit and WP, Jest, Playwright with axe, Plugin Check) on a clean site, then merges to main, tags, and builds the zips.

Cursor prompt for a package (nothing else is needed):

```
Do package F239-2: read docs/dev/packages/F239-2.md and follow .cursor/rules/subtleforms.mdc. Finish with the report block.
```

If a session runs out of context, start a new one with the same prompt plus: `Continue: these IDs are already committed on pkg/F239-2: <IDs>.`

This folder is for development only and is excluded from the plugin zip and from SVN.
