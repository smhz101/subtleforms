# Branch protection for main

GitHub settings cannot be changed from a pull request. The repository owner sets
them once. Until then `main` is unprotected and nothing forces the checks below.

## Settings steps

1. Open the repository on GitHub, then Settings, Branches.
2. Under Branch protection rules choose Add branch protection rule (or edit the
   existing rule). Branch name pattern: `main`.
3. Tick Require a pull request before merging. Tick Require approvals only if a
   second person exists (there is no other developer today, so leave it off).
4. Tick Require status checks to pass before merging and Require branches to be
   up to date before merging.
5. In the search box add each check name listed below, exactly as written.
   A name only appears in the search after it has run once on the repository.
6. Tick Require conversation resolution before merging.
7. Leave Allow force pushes and Allow deletions off. Save changes.

## Required checks

Add exactly these:

- Unit tests (PHPUnit and Jest)
- Browser and accessibility tests (WordPress + Playwright + axe)
- PHP 8.1
- PHP 8.2
- PHP 8.3
- JS Quality
- Build Plugin
- WordPress Plugin Check
- POT freshness check

Do not add `Browser shard 1 of 2` or `Browser shard 2 of 2`. They are the
parallel parts of the browser run. The check named
`Browser and accessibility tests (WordPress + Playwright + axe)` fails when
either shard fails, so it is the one to require.

## Notes

- Every workflow runs on pull requests without a paths filter on purpose. A
  required check that is skipped by a paths filter never reports and would block
  the merge forever.
- `POT freshness check` is strict only for pull requests from `release/*`
  branches. On every other pull request a stale POT is a warning.
- `Release to WordPress.org` is a manual workflow and is not a required check.
