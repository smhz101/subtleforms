# Recon (Phase 1) — 2026-10-14

## Access status (read this first)

| Target | Result | Consequence |
|---|---|---|
| staging.subtleforms.com (HTTPS, REST, wp-admin) | **Blocked.** The cloud environment's network policy answers 403 to every CONNECT outside the allow-list. DNS also fails from the fetch tool. | Nothing on staging could be inspected, backed up or changed in this session. WP File Manager was never used. |
| Built-in browser pane ("I will enter the credentials") | **Not available** in this session (no browser tools were exposed). | Same as above. |
| Reference sites (webflow.com, insense.pro, quant.network, fluentforms.com) and competitor sites | **Blocked** by the same policy. | Competitor colour audit and comparison pages are from prior knowledge only and are marked unverified. |
| github.com (git clone, raw files) | Reachable | Used to clone WordPress core (master) and the SQLite database integration plugin for a local build environment. |
| registry.npmjs.org | Reachable | Used to fetch the four open-licence font packages (fontsource) for self-hosting. |
| Magnific MCP | Working | Premium plan, 19,785 credits available at session start (215 already spent on the two earlier tests). |
| Google Drive "SubtleForms Assets" | Working | All five planning files read: master prompt, typography, image prompts, video shots, Fable prompt pack. |

How to unblock staging: in the cloud environment settings (title bar menu, Edit), set Network access to a broader level or add `staging.subtleforms.com` under Allowed domains. The reference and competitor domains need the same treatment for a verified audit.

## What was NOT verified on staging (must be checked when access exists)

- WordPress version, WooCommerce version, active theme, plugin list, permalink structure.
- Whether the SubtleForms plugin is installed (Home page uses a code-built form mockup until confirmed, flagged in the asset manifest and patterns).
- WooCommerce products and prices. Pricing uses **clearly marked placeholders**: Pro $99/yr, Agency $299/yr. See `docs/progress.md` open questions.
- The license-server plugin and Paddle settings (never to be touched anyway).
- A backup or snapshot. **No backup was taken because nothing on staging was changed.** Take one before deploying this theme.

## Local build environment used instead

- WordPress core cloned from GitHub (`master`, reports as 7.2-alpha) running on PHP 8.3 built-in server with the SQLite database integration plugin. Lives in the session scratchpad, not in the repo.
- The theme is developed in this repository at `site/subtleforms-site/` and symlinked into the local install, so every template, pattern and block is exercised in a real block editor before it ships.
- Staging runs 7.1.x according to the master prompt; nothing in the theme relies on 7.2-only APIs (theme.json v3, Interactivity API, block bindings and `register_block_pattern` are all 6.5+).

## Plugin repository facts (this repo)

- `subtleforms.php` is the plugin itself; the marketing site theme is new and lives under `site/`.
- Node 22 is active here; the project asks for Node 20 (`nvm use 20`) for the plugin build. The theme needs no build step.
