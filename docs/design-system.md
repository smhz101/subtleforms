# SubtleForms design system (v1, 2026-10-14)

This file is the contract. Every agent, pattern and block works from it. Tokens below are mirrored one-to-one in `site/subtleforms-site/theme.json`, so the owner can change them in Appearance > Editor > Styles.

## 1. The idea in one line

**The throughline.** Every other form builder's story ends at the Submit button. Ours starts there. The signature is a single line that leaves the button and keeps going: to the inbox, the CRM, the follow-up, the report. It is drawn in code (SVG + CSS), never as a raster, and it is the only thing on the site allowed to be lime.

Where it appears: the logo mark (a button-shaped node with a line leaving it, ending in a dot), the Home hero (the line leaves a real code-built form card and fans out to three outcome cards), section transitions (the line crosses from a dark section into a light one and changes from lime to forest as it enters cream), empty states (a line arriving at nothing yet), loading states (the dot travelling), and the 404 (the line stops, the dot waits).

Why it beats the starting hypothesis "the path": "a line with a moving dot" is generic motion-graphics language. Anchoring the line to the Submit button makes it an argument, not decoration. It literally draws the product difference.

## 2. Colour

Roles, hex, and the share of a typical page each should occupy.

| Token | Hex | Role | Share |
|---|---|---|---|
| `ink` | `#0B1512` | Dark base. Hero, agency band, final call to action, footer. Body text on light. | 35% |
| `moss` | `#1C332C` | Raised surfaces on ink: cards, code blocks, the form mockup on dark. | 8% |
| `forest` | `#2F5D50` | Headings and eyebrows on cream, secondary buttons, lines and the throughline when it crosses cream. | 12% |
| `mint` | `#7FE7C4` | Soft highlight on dark only: hover states, chart fills, secondary accent text on ink. | 3% |
| `lime` | `#C8FF3D` | The signal. The throughline on dark, the primary button, the "next step" badge. Nothing else. | 2% |
| `cream` | `#F6F1E7` | Light base. Problem section, how-it-works, pricing, docs. | 32% |
| `paper` | `#FFFDF9` | Cards on cream. | 5% |
| `sand` | `#E8E1D2` | Hairlines, dividers, sunken surfaces (inputs) on cream. | 2% |
| `stone` | `#55665F` | Muted text on cream (captions, fine print). | 1% |
| `fog` | `#A7B5AE` | Muted text on ink and moss. | — |

Rules
- Lime marks the next step. It is never a background, a large fill or body text. If a page has lime in more than three places, remove one.
- Lime and mint never touch cream (about 1:1 contrast). On cream the throughline and accents are forest.
- Buttons: lime fill with ink text on dark sections; ink fill with cream text on light sections. Never white text on lime or mint.
- No blue, no purple, no gradient that leaves the palette. Depth comes from moss on ink and sand on cream.
- Dark and light sections alternate deliberately. A page starts dark (hero), breathes light (problem, how it works), returns dark for the product moment, light for tiers and FAQ, dark for the final call. Transitions are made by the throughline divider, not a hard edge.

Verified contrast (WCAG 2.2 AA needs 4.5:1 for text, 3:1 for large text and UI). Computed with the WCAG relative-luminance formula in this session.

| Pair | Ratio | Verdict |
|---|---|---|
| ink on cream, cream on ink | 16.5:1 | body text |
| forest on cream | 6.7:1 | headings, eyebrows, links |
| stone on cream | 5.4:1 | muted text |
| forest on sand | 5.8:1 | text on sunken surfaces |
| lime on ink | 15.8:1 | accent text, throughline |
| ink on lime | 15.8:1 | primary button text |
| mint on ink | 12.5:1 | secondary accent |
| fog on ink | 8.7:1 | muted text on dark |
| fog on moss | 6.3:1 | muted text on cards on dark |
| cream on moss | 12.0:1 | text on cards on dark |
| lime on moss | 11.4:1 | throughline over cards |
| cream on forest | 6.7:1 | secondary button |
| lime on cream | 1.04:1 | **never** |

Why this palette and not the competitors'. From prior knowledge (the live sites could not be fetched in this session, so treat as unverified until re-checked): Gravity Forms leans orange on dark navy, WPForms leans orange on dark navy, Fluent Forms leans blue and indigo. Webflow is a saturated blue. The green-black, cream and lime set shares none of those dominant hues, reads as warm rather than corporate, and gives the signal colour real scarcity because nothing else in the palette is bright.

## 3. Typography

Three families plus one accent, all SIL Open Font License, self-hosted as WOFF2 from the theme (`assets/fonts/`). No third-party font requests. Total payload 115 KB (Latin subsets, variable weight axis only).

| Role | Family | File | Size |
|---|---|---|---|
| Display and headings | Bricolage Grotesque, variable weight 200–800 | `bricolage-grotesque-latin-wght-normal.woff2` | 41 KB |
| Accent (one italic word per headline, at most) | Instrument Serif Italic 400 | `instrument-serif-latin-400-italic.woff2` | 22 KB |
| Body and UI | Geist, variable weight 100–900 | `geist-latin-wght-normal.woff2` | 29 KB |
| Labels, prices, code | Geist Mono, variable | `geist-mono-latin-wght-normal.woff2` | 23 KB |

Scale (fluid, theme.json slugs are permanent)

| Slug | Min → max | Line height | Weight | Tracking | Use |
|---|---|---|---|---|---|
| `display` | 3rem → 6rem | 0.96 | 700 | -0.035em | Home hero only |
| `huge` | 2.5rem → 4.5rem | 1.02 | 700 | -0.03em | H1 |
| `xxxl` | 2rem → 3.25rem | 1.06 | 650 | -0.025em | H2 |
| `xxl` | 1.5rem → 2.125rem | 1.15 | 600 | -0.02em | H3 |
| `xl` | 1.25rem → 1.5rem | 1.25 | 600 | -0.01em | H4, card titles |
| `lg` | 1.125rem → 1.375rem | 1.5 | 400 | 0 | Lead paragraph |
| `base` | 1.0625rem | 1.6 | 400 | 0 | Body |
| `sm` | 0.9375rem | 1.5 | 400 | 0 | Secondary |
| `xs` | 0.8125rem | 1.45 | 500 | 0.01em | Fine print, trial terms |
| `label` | 0.75rem | 1.3 | 500 | 0.08em upper | Eyebrows, Geist Mono |

Detail rules: `text-wrap: balance` on headings, `text-wrap: pretty` on paragraphs, measure 60–70 characters (`--wp--style--global--content-size` is 42rem for prose), tabular figures (`font-variant-numeric: tabular-nums`) on prices and tables, real quotation marks, the accent word is marked up as `<em>` inside the heading so the owner can move it by italicising a different word.

## 4. Spacing, layout, shape

Spacing scale (theme.json `spacingSizes`, 4-based, fluid at the top end):
`1` 0.25rem · `2` 0.5rem · `3` 0.75rem · `4` 1rem · `5` 1.5rem · `6` 2rem · `7` 3rem · `8` clamp(4rem, 8vw, 6rem) · `9` clamp(6rem, 12vw, 9rem)

Vertical rhythm: sections use `8` padding on cream and `9` on ink, so dark sections feel bigger. Never two sections with the same height in a row. One section per page breaks the grid: the hero media hangs off the right edge, the agency band's cards overflow the container, the comparison table runs wide.

Layout widths: content 42rem (prose), wide 72rem (sections), full bleed for ink bands. Side gutter 1rem at 360px, 1.5rem at 768px, 2rem above.

Radii: `xs` 6px (inputs, badges) · `sm` 10px (buttons) · `md` 16px (cards) · `lg` 24px (media, hero stage) · `pill` 999px (eyebrow chips).

Depth: no default drop shadows. Two recipes only.
- On cream: `shadow-lift` = `0 0 0 1px var(sand), 0 24px 48px -28px rgba(11,21,18,.28)`.
- On ink: `shadow-glow` = `0 0 0 1px rgba(127,231,196,.14), 0 32px 64px -32px rgba(200,255,61,.18)`.
Texture: a fixed SVG noise overlay at 4% opacity on ink sections (`.has-grain`), never on cream.

## 5. Motion

| Token | Value | Use |
|---|---|---|
| `duration-micro` | 150ms | focus rings, colour changes |
| `duration-hover` | 250ms | button lift, card hairline brightening |
| `duration-reveal` | 600ms | section fade-up on enter |
| `duration-path` | 2400ms | the dot travelling the throughline |
| `ease-standard` | cubic-bezier(.2, .7, .2, 1) | almost everything |
| `ease-settle` | cubic-bezier(.16, 1, .3, 1) | things that land (cards, dots) |
| `ease-path` | cubic-bezier(.45, 0, .2, 1) | the dot |

Rules: motion is led by the throughline. Buttons lift 1px and brighten, never scale. Cards do not move on hover, their hairline brightens to mint (dark) or forest (light). `prefers-reduced-motion: reduce` stops the dot at the end of the line, shows the hero poster instead of the video, and removes reveals. Nothing animates on scroll except a single fade-up.

## 6. Imagery

- AI is for atmosphere only: deep green-black space, soft forest glow, fine grain, one thin mint or lime line. Hero and dark band backgrounds. Generated with Seedream 5 Pro at 2k; video with Kling 2.5 at 720p (see `docs/asset-manifest.md`).
- Never AI: product UI, interface text, diagrams, logos, people. Product moments are built from core blocks with block styles (`sf-form-card`, `sf-outcome-card`, `sf-window`), so the text is sharp, editable and never a screenshot of a screenshot.
- Sample data is fictional and generic ("Request a quote", "Acme Dental", "Thursday 10:00"). No real names or emails.
- Every content image has a one-sentence alt. Atmosphere images are decorative with empty alt.

## 7. Component shape language

Buttons, inputs, badges and cards share the same corner family (`sm` for small, `md` for cards). Primary button: lime fill, ink text, 600, sentence case, 0.75rem/1.25rem padding, hover lifts 1px and the fill moves to `#D4FF5C`, focus is a 2px mint ring offset 3px (on cream, a 2px forest ring). Secondary: transparent, 1px hairline (mint on ink, forest on cream), hover fills 8% of the hairline colour. Disabled: 40% opacity, no lift.

Eyebrow: Geist Mono label, uppercase, forest on cream or mint on ink, with a 6px dot in the same colour before it (the dot is the throughline's dot at rest).

## 8. Block styles registered by the theme

`sf-form-card`, `sf-outcome-card`, `sf-window` (product mockup frames), `sf-card` (plain lifted card), `sf-eyebrow` (paragraph), `sf-badge` (paragraph), `sf-glow` (group, dark glow section), `sf-grain` (group, noise overlay), `sf-ghost` (button, secondary), `sf-pill` (button), `sf-faq` (details), `sf-matrix` (table). Each has a label in the editor's style picker.
