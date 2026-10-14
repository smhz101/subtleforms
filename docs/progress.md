# Progress

Last updated: 2026-10-14 (session 1)

## Done
- Recon of what was reachable; staging and the open web are blocked by the environment network policy (`docs/recon.md`).
- Local WordPress (core from GitHub + SQLite plugin) running in the session scratchpad for real editor and front-end testing.
- Drive planning files read. Design system decided and written (`docs/design-system.md`).
- Theme skeleton `site/subtleforms-site/`: theme.json v3 tokens, self-hosted fonts (115 KB), block styles, section styles, Ink style variation, header/footer/announcement parts, templates (page-wide, page-prose, page, index, archive, search, single, 404).
- Custom blocks: `subtleforms/path` (Throughline, server-rendered SVG, editable preset/colour/speed/direction) and `subtleforms/hero-media` (poster + loop, reduced-motion aware, Interactivity API).
- Home hero pattern built from core blocks + block styles.
- Hero backdrop images generated in Magnific (200 credits). Cannot be downloaded here; CSS atmosphere used meanwhile.

## In progress
- Hero gate: screenshots at desktop and mobile from the local install.

## Next (after hero approval)
- Remaining Home sections as patterns: problem, how it works, product moment, tiers, agency band, comparison teaser, FAQ, final CTA (synced).
- Pages: Features, Pricing (+ pricing selector block reading WooCommerce variations), Compare hub + 3, Use cases ×3, Docs, Changelog, About, Contact, 4 legal drafts.
- Editing guide, QA report, reviewer loop, Lighthouse/axe.

## Open questions for the owner
1. Network policy: allow `staging.subtleforms.com`, the reference/competitor domains and `pikaso.cdnpk.net` (Magnific CDN) in the environment settings so the theme can be deployed, the audit verified and the generated assets fetched.
2. Prices for Pro and Agency (placeholders $99/yr and $299/yr until read from WooCommerce).
3. WordPress.org slug for Starter (links assume `wordpress.org/plugins/subtleforms/`).
4. Trial length: hero and pricing copy say 7 days. Confirm, or switch to 14.
