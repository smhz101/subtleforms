Thank you for reviewing SubtleForms (free plugin) — release v1.5.0.

Summary of changes

- Security & sanitization: All form submission payloads are sanitized server-side prior to persistence (email, url, numeric, text, arrays). See `src/Engine/Actions/SaveAction.php` for details.
- Spam protection: Added configurable honeypot and minimum submission time settings (Settings → Spam Protection) and validation in `src/Engine/SpamProtection.php` and `src/Support/Settings.php`.
- Privacy: Added or improved data export/erasure hooks and retention settings (GDPR tool integration). See `src/Privacy/*` and `src/Support/Settings.php`.
- Accessibility: Frontend fields include stable `id` attributes, labels use `htmlFor`, and ARIA attributes were added (see `resources/frontend/components/FieldRenderer.jsx`).
- i18n: Added translators comments and ordered placeholders across admin UI strings; regenerated `languages/subtleforms.pot`.
- Packaging: Prepared WordPress.org-compatible `readme.txt` and generated a release ZIP: `subtleforms-v1.5.0.zip` (in project root via `npm run dist:zip`).

How to test (quick checklist for reviewer)

1. Install the plugin (upload `subtleforms-v1.5.0.zip` via Plugins > Add New > Upload).
2. Visit SubtleForms → Settings and verify Honeypot settings are present and save works.
3. Create a form in the Builder, publish it, and place the shortcode on a page.
4. Submit a form normally (verify valid submissions) and inspect saved data for sanitized values (emails, URLs, HTML allowed where configured).
5. Test spam protection by submitting with honeypot filled or by submitting under min time (should be rejected).
6. Export submissions as CSV, confirm values match expectations and contain sanitized content.
7. Use Tools → Export Personal Data and Erase Personal Data for a submission and confirm endpoints behave correctly.
8. Verify accessible markup: inputs have `id`/`htmlFor` labels and ARIA attributes where applicable.
9. Quick smoke: run admin pages and ensure no JS errors in console; verify translations load and POT contains updated comments.

Notes for reviewer

- No breaking API changes to the REST endpoints; storage format stays compatible.
- If you want to run automated checks locally: `npm ci && npm run build && npm test`.

If you have any questions or need extra artifacts (screenshots, more logs), reply here and I’ll provide them promptly. Thanks!
