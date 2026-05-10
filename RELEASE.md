# Release Process

This document covers the full release process for SubtleForms — from development branch to live on WordPress.org.

## Overview

| Repository | Purpose |
|------------|---------|
| **GitHub** (`main` branch) | Development, PRs, CI, artifact builds |
| **WordPress.org SVN** (`/trunk`) | Live release — what users receive |
| **WordPress.org SVN** (`/tags/{version}`) | Immutable snapshot of each released version |

**Rule:** Never edit SVN directly. All changes flow through GitHub → CI → SVN deploy workflow.

---

## Release branch process

1. Cut a release branch from `main`:
   ```bash
   git checkout main && git pull
   git checkout -b release/1.9.0
   ```

2. Make only these changes on the release branch:
   - Bump `Version:` in `subtleforms.php`
   - Bump `SUBTLEFORMS_VERSION` constant in `subtleforms.php`
   - Bump `version` in `package.json`
   - Update `Stable tag:` in `readme.txt`
   - Add changelog entry to `readme.txt`
   - Add upgrade notice to `readme.txt` (if notable)

3. Open a PR from `release/1.9.0` → `main`. Get it reviewed and merged.

4. After merge, tag `main` locally (do not push yet — see release workflow):
   ```bash
   git tag v1.9.0
   ```

---

## Version bump checklist

Before opening the release PR, verify every item:

- [ ] `Version: 1.9.0` in `subtleforms.php` plugin header
- [ ] `define( 'SUBTLEFORMS_VERSION', '1.9.0' )` in `subtleforms.php`
- [ ] `"version": "1.9.0"` in `package.json`
- [ ] `Stable tag: 1.9.0` in `readme.txt`
- [ ] `Tested up to:` in `readme.txt` reflects the latest tested WordPress version
- [ ] `Requires at least:` in `readme.txt` still accurate
- [ ] `Requires PHP:` in `readme.txt` still accurate
- [ ] Changelog entry added under `== Changelog ==` in `readme.txt`
- [ ] Upgrade notice added under `== Upgrade Notice ==` in `readme.txt` (if user action needed)
- [ ] All changelog entries since last release are included (check git log)

---

## readme.txt stable tag checklist

The WordPress.org update system uses `Stable tag` to determine the current version. A mismatch between the plugin header `Version:` and the `Stable tag:` causes:

- Users on old versions not receiving update notifications
- WordPress.org review rejections

**Current status (as of this writing):**
- `subtleforms.php` Version: `1.8.1`
- `readme.txt` Stable tag: `1.6.10` ← **MUST be fixed before WordPress.org submission**

---

## Final Plugin Check before submission

Run the [WordPress Plugin Check tool](https://wordpress.org/plugins/plugin-check/) against the production ZIP before submitting:

```bash
npx gulp quickZip
# Install plugin-check plugin on local WP, then run against dist/subtleforms-{version}.zip
```

Or use the CI artifact from the `build-plugin` job and run Plugin Check locally.

All "Required" and "Recommended" checks must pass. "Informational" checks can be noted for later.

---

## Manual WordPress.org deployment

> ⚠️ Do not do this until the automated release workflow prerequisites in
> `.github/workflows/release-wordpress-org.yml` are fully satisfied.

Until the automated workflow is enabled, deployments are manual:

```bash
# 1. Check out SVN
svn co https://plugins.svn.wordpress.org/subtleforms /tmp/svn-subtleforms

# 2. Sync production files to /trunk (respecting .distignore)
rsync -rc --exclude-from=.distignore . /tmp/svn-subtleforms/trunk/ --delete

# 3. Commit trunk
cd /tmp/svn-subtleforms
svn add --force trunk/.
svn ci trunk/ -m "Release 1.9.0"

# 4. Tag the release
svn cp trunk tags/1.9.0
svn ci tags/1.9.0 -m "Tagging 1.9.0"
```

---

## Automated release workflow

The workflow at `.github/workflows/release-wordpress-org.yml` is currently **disabled** (`if: false` guard on the deploy job).

Enable it only after:

1. WordPress.org plugin submission approved.
2. GitHub secrets set:
   - `WORDPRESS_ORG_USERNAME` — your wordpress.org username
   - `WORDPRESS_ORG_PASSWORD` — an application password (not your login password)
3. Known packaging issues below are resolved.
4. Dry-run verified: trigger the workflow with `dry_run: true` first.

---

## Known packaging issues

The `gulpfile.js` `copyFilesToTemp` task currently **omits** these files from the release ZIP:

| Missing file/folder | Impact |
|---------------------|--------|
| `readme.txt` | WordPress.org update page has no description |
| `uninstall.php` | Plugin cleanup does not run on uninstall |
| `languages/` | Translations not shipped with the plugin |
| `readme.html` | Referenced but file does not exist |

The `buildProduction` function in `gulpfile.js` only runs `npm run build` (admin only), not `npm run build:all`. The CI build-plugin job works around this by running `build:all` before `gulp quickZip`.

**These must be fixed before deploying to WordPress.org.**

---

## SVN repository structure

```
https://plugins.svn.wordpress.org/subtleforms/
├── trunk/         ← current development/release (what auto-updates deliver)
├── tags/
│   ├── 1.8.1/     ← immutable snapshot
│   └── 1.9.0/     ← immutable snapshot
└── assets/        ← plugin directory banner, icon, screenshots (not in ZIP)
```

`/assets` in SVN is separate from the plugin ZIP. Upload here:
- `icon-128x128.png` and `icon-256x256.png`
- `banner-772x250.png` and `banner-1544x500.png`
- `screenshot-1.png`, `screenshot-2.png`, etc.

These are not yet created. See the WordPress.org readiness audit for details.
