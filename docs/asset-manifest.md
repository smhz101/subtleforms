# Asset manifest

Budget for the first build: 3,500 Magnific credits. Spent so far: **200** (plus 215 spent before this session on two tests).

## Important: generated files cannot be downloaded from this environment

The Magnific MCP generates fine, but the environment's network policy blocks the CDN that serves the results (pikaso.cdnpk.net). Both hero renders exist in the owner's Magnific Personal project and can be downloaded from there. Until the network policy allows that host (or the owner uploads the files to the Media Library), the hero uses a **CSS atmosphere** built from the palette (two radial glows in forest and moss, a faint mint lift, SVG grain). It weighs 0 KB, so LCP is the headline, not an image. The hero media block accepts a poster and a loop the moment they exist, with no code change.

| ID | Section / job | Format | Model | Prompt | Credits | Status |
|---|---|---|---|---|---|---|
| IMG-01a/b | Home hero backdrop (atmosphere behind the throughline stage) | 21:9, 2k PNG → AVIF 2560w | Seedream 5 Pro | "Vast deep green-black darkness with a soft forest green glow rising from the lower right, fine film grain, a single thin pale mint line of light drifting across the dark and ending in a small glowing dot, the left half calm and empty" | 200 (2 variants) | Generated, in Magnific Personal project, not yet reviewed or downloaded |
| VID-01 | Home hero loop, 8 s, muted, poster = IMG-01 | MP4 + WebM, 720p, under 2 MB | Kling 2.5 (280 credits for 10 s at 720p, simulated) | Not generated: no way to review or download the result here | 0 | Deferred |

Not AI, built in code: the logo mark (CSS data-URI SVG in the wordmark block style), the throughline (Throughline block), the form mockup and outcome cards (core blocks + block styles), grain (SVG filter data URI).

## Model notes (verified 2026-10-14 on this account)

- Account: Premium, 19,785 credits available at session start.
- Seedream 5 Pro works despite `requiresPremium: true` in the catalog (the account is Premium). 100 credits per 2k image at 21:9.
- Magnific One: 180 credits per 2k image at 21:9 (simulated).
- Kling 2.5: 280 credits for 10 s at 720p (simulated). Seedance 2.0 Mini: 1,120 credits for 8 s at 720p (simulated) — avoid.
- Short descriptive prompts with no exclusion lists, as the earlier test showed.
