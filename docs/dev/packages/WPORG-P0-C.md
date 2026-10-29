# WPORG-P0-C — Input sanitization / validation (P0-3)

**Owning repo:** SubtleForms Free
**Branch:** `pkg/wporg-p0-input-sanitization` (from Package B tip / WordPress.org release line)
**Release target:** next Free release prepared for WordPress.org

## Goal

Address WordPress.org Package C findings on public classic submit input handling, admin GET nonce verification, and public REST route URI parsing. Prefer existing `Sanitizer` / Uploads nonce patterns. Do not invent ledger bug IDs.

## In scope

- Classic POST (`PublicSubmitApi` / `ClassicResult`) sanitize-before-temporary-storage while preserving multiline and typed values; prove permanent storage path already sanitizes
- `AdminMenu` GET `_wpnonce`: `wp_unslash` + `sanitize_text_field` before `wp_verify_nonce`
- `PublicRoutes` `REQUEST_URI` normalize/sanitize before parse
- Bounded adjacent Free API/admin search for the same categories only
- Regression unit tests and a Security (or Fixed) changelog fragment

## Out of scope

- Flattening all fields with `sanitize_text_field` (destroys multiline / rich text)
- Free–Pro CONTRACT, version bumps, Pro / License Server
- Full-plugin audit beyond the three categories
- Renaming or symlinking the primary plugin install

## Acceptance

1. Classic submit answers that reach a classic result transient are sanitized (tags stripped; multiline kept). Permanent submit storage remains validated then sanitized (including rich_text restore).
2. Malicious HTML/script in classic answers does not survive into transient values.
3. Valid admin action nonce passes; missing, empty, array, or wrong nonce fails safely.
4. Valid REST public paths still resolve from encoded URIs; malformed URIs do not yield a public route.
5. Version remains 2.7.2 on this package branch.
