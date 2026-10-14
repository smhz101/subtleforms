# Change log and rollback notes

All changes in this session happened **in this repository and in a local WordPress**, never on staging (network policy blocked it, see `docs/recon.md`).

| Date | Change | Rollback |
|---|---|---|
| 2026-10-14 | Added `site/subtleforms-site/` block theme (theme.json v3, templates, parts, patterns, 2 custom blocks, self-hosted fonts). | Delete the folder or switch the active theme back. No database changes outside page content created by the theme's own patterns. |
| 2026-10-14 | Added `docs/` (recon, design system, asset manifest, progress, editing guide). | Delete `docs/`. |

## When deploying to staging

1. Take a full backup (files + database) with the host's tool first.
2. Upload `site/subtleforms-site/` to `wp-content/themes/subtleforms-site/` and activate it in Appearance > Themes.
3. Create the pages from the patterns (see `docs/editing-guide.md`).
4. Rollback: re-activate the previous theme. Pages created from patterns can be trashed.

## Local-only notes (not deployed)

- `sync-theme.sh` and `sync-page.php` in the session scratchpad copy the repo theme into the local WordPress and (re)create the Home page from `patterns/hero-home.php`. They are not part of the repo.
