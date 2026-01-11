SubtleForms — QA Checklist (pre-submission)

1. Basic install

- [ ] Upload `subtleforms-v1.5.0.zip` via Plugins → Add New → Upload and activate.
- [ ] Confirm plugin reports correct version in Plugins screen.

2. Settings

- [ ] Visit SubtleForms → Settings and save default settings.
- [ ] Verify Honeypot toggle and Min submission time exist and persist.

3. Builder & Publishing

- [ ] Create a new form (use Quick Wizard), add fields, save and publish.
- [ ] Confirm autosave and manual save show 'Saved' and 'Saving...' correctly.
- [ ] Duplicate, delete, and rename forms to ensure bulk actions work.

4. Frontend submission & sanitization

- [ ] Add form shortcode to a page and submit valid data; confirm saved submission (check data sanitization for email/url/text).
- [ ] Submit a payload including potential HTML (where allowed) and verify sanitization.

5. Spam protection

- [ ] With honeypot enabled, submit a form with honeypot field filled — it should be rejected.
- [ ] Submit form faster than Min submission time — should be rejected when time trap active.

6. Submissions screen

- [ ] Open Submissions list; verify columns, filters, search and pagination work.
- [ ] Select multiple submissions and perform bulk delete/mark operations; verify notices.
- [ ] Export CSV and inspect content for expected sanitization.

7. Privacy

- [ ] Use Tools → Export Personal Data for a user/email and confirm data generated.
- [ ] Use Tools → Erase Personal Data and confirm data is removed.

8. Accessibility & i18n

- [ ] Verify inputs have `id` attributes and labels `htmlFor`.
- [ ] Check ARIA attributes present for fields like required/invalid.
- [ ] Verify POT contains translator comments and regenerate if desired (`wp i18n make-pot . languages/subtleforms.pot`).

9. Admin UX

- [ ] Open Form Builder, Builder header and Submissions pages and look for console errors.
- [ ] Confirm notices/messages use ordered placeholders and translator comments (no POT warnings).

10. Packaging & build

- [ ] Run `npm ci && npm run build` locally; ensure no build errors and assets are produced.
- [ ] Generate distribution zip: `npm run dist:zip` and confirm `subtleforms-vX.Y.Z.zip` created.

11. Tests & CI

- [ ] Run JS unit tests: `npm test` (ensure dev deps installed).
- [ ] Confirm CI workflow at `.github/workflows/ci.yml` runs on PR and pushes.

Notes / Known issues

- Some JS tests may require additional dependencies in CI; report any failing tests with logs and I’ll fix them immediately.

If anything fails, paste the console output and the failing step and I’ll address it promptly.
