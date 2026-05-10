# Contributing to SubtleForms

Thank you for contributing. This document explains the development workflow, standards, and process for getting changes into the codebase.

## Table of contents

- [Branch naming](#branch-naming)
- [Commit message style](#commit-message-style)
- [Development workflow](#development-workflow)
- [Pull request process](#pull-request-process)
- [Required CI checks](#required-ci-checks)
- [Local development commands](#local-development-commands)
- [Code standards](#code-standards)

---

## Branch naming

Use the following prefixes:

| Prefix | When to use |
|--------|-------------|
| `feat/` | New feature |
| `fix/` | Bug fix |
| `refactor/` | Code change with no functional change |
| `chore/` | Tooling, CI, dependencies, docs |
| `security/` | Security fix — keep branch private until patched |
| `release/` | Release preparation (version bump, changelog) |

Examples:
```
feat/multi-file-upload
fix/submission-export-encoding
chore/update-node-20
security/nonce-bypass-patch
release/1.9.0
```

No direct commits to `main`. All changes go through a pull request.

---

## Commit message style

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>: <short imperative description>

Optional longer body. Explain WHY, not WHAT.
```

Types: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `security`.

Examples:
```
feat: add Turnstile CAPTCHA provider
fix: escape form name in submissions list output
chore: replace CircleCI config with GitHub Actions CI
security: verify nonce on bulk-delete submissions endpoint
```

Keep the subject line under 72 characters. Reference issues with `Closes #123` in the body.

---

## Development workflow

1. **Fork or branch** — create a branch from `main` using the naming convention above.
2. **Make changes** — keep each PR focused on one thing.
3. **Test locally** — run the checks listed in [Local development commands](#local-development-commands).
4. **Open a PR** — fill in the PR template completely.
5. **Address review feedback** — push new commits; do not force-push after review starts.
6. **Merge** — squash merge preferred for feature/fix branches; merge commit for release branches.

---

## Pull request process

- PRs must target `main`.
- The PR description must use the provided template.
- At least one reviewer approval is required before merge.
- All required CI checks must be green.
- Do not merge your own PR unless it is a trivial chore or docs change.
- For security fixes, coordinate with the maintainer before opening a public PR.

---

## Required CI checks

All PRs must pass:

| Check | What it does |
|-------|-------------|
| `PHP 7.4 / 8.1 / 8.2 / 8.3` | Syntax check, composer validate, PHPUnit unit tests |
| `JS Quality` | `npm run lint` (when configured), `npm run test` |
| `Build Plugin` | Full `npm run build:all` + `gulp quickZip` — artifact must upload |

The **PHPCS** and **WordPress Plugin Check** steps run with `continue-on-error: true` during the initial cleanup period. Once the codebase is WPCS-compliant, these will become hard failures.

---

## Local development commands

### PHP

```bash
# Install PHP dependencies
composer install

# Run unit tests
vendor/bin/phpunit --testsuite unit --no-coverage

# Run PHPCS (requires global WPCS install — see below)
phpcs --standard=.phpcs.xml.dist src/ subtleforms.php

# Install WPCS globally (one-time)
composer global require \
  squizlabs/php_codesniffer:^3.9 \
  wp-coding-standards/wpcs:^3.1 \
  phpcompatibility/phpcompatibility-wp:^2.1 \
  dealerdirect/phpcodesniffer-composer-installer:^1.0
```

### JavaScript / Assets

```bash
# Install Node dependencies
npm ci --legacy-peer-deps

# Build admin panel only (fast, for development)
npm run build

# Build all assets (admin + frontend + blocks)
npm run build:all

# Watch admin for changes
npm start

# Watch frontend for changes
npm run start:frontend

# Run JS unit tests
npm test

# Run E2E tests (requires local WP install at configured URL)
npm run test:e2e
```

### Distribution

```bash
# Create production ZIP (uses already-built assets)
npx gulp quickZip

# Full build + ZIP
npx gulp dist

# Output: dist/subtleforms-{version}.zip
```

---

## Code standards

### PHP

- Follow [WordPress PHP Coding Standards](https://developer.wordpress.org/coding-standards/wordpress-coding-standards/php/).
- All classes in the `SubtleForms\` namespace, under `src/`.
- Sanitize all input at system boundaries; escape all output in context.
- Use `$wpdb->prepare()` for every SQL query with dynamic values.
- Always check `current_user_can()` before privileged operations.
- Add nonce verification to every state-changing request.
- Text domain: `subtleforms` — use `__()`, `esc_html__()`, `_n()`, etc.

### JavaScript / React

- All source code lives in `resources/` (never edit `build/` directly).
- Follow the existing component structure under `resources/admin/`.
- Use `@wordpress/api-fetch` for REST API calls (nonce is handled automatically).
- No inline styles — use SCSS modules in the existing file structure.

### Security

See [SECURITY.md](SECURITY.md) for the responsible disclosure policy.  
See [docs/secure-coding.md](docs/secure-coding.md) for detailed coding guidelines.
