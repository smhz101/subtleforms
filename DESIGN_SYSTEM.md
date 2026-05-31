# SubtleForms Design System

> **For AI agents and contributors.** This document is the single source of truth for visual decisions. Do not introduce colors, fonts, spacing, shadows, or component patterns that are not listed here. When in doubt, reference `_variables.scss`, `_tokens.scss`, and `_design-system.scss`.

---

## 1. Aesthetic Philosophy — "Technical Elegance"

SubtleForms fuses **precision with warmth**. The palette is dominated by warm stone neutrals (never cold grays) with an electric lime accent. It deliberately avoids generic SaaS patterns (blue-heavy flat design, rounded pill badges, pure white surfaces) while staying fully compatible with the WordPress admin shell.

**Three governing rules:**
1. Warm neutrals first, electric accent second.
2. Every interactive element must have a visible `:focus-visible` outline (WCAG 2.1 AA).
3. All SCSS values must trace back to a token — bare hex values are not allowed in component SCSS.

---

## 2. Color System

### 2.1 Warm Neutral Palette (primary grays — use these instead of `gray-*`)

| Token | SCSS var | Hex | Use |
|---|---|---|---|
| Stone 50 | `$sf-stone-50` | `#fafaf9` | Page background |
| Stone 100 | `$sf-stone-100` | `#f5f5f4` | Subtle background |
| Stone 200 | `$sf-stone-200` | `#e7e5e4` | Borders (default) |
| Stone 300 | `$sf-stone-300` | `#d6d3d1` | Borders (strong) |
| Stone 400 | `$sf-stone-400` | `#a8a29e` | Placeholder / muted text |
| Stone 500 | `$sf-stone-500` | `#78716c` | Secondary text |
| Stone 600 | `$sf-stone-600` | `#57534e` | Body text |
| Stone 700 | `$sf-stone-700` | `#44403c` | Primary text |
| Stone 800 | `$sf-stone-800` | `#292524` | Headings |
| Stone 900 | `$sf-stone-900` | `#1c1917` | Near-black / icon fill |

### 2.2 Electric Accent — Brand Lime

| Token | SCSS var | Hex | Use |
|---|---|---|---|
| Lime 400 | `$sf-lime-400` | `#a3e635` | Hover state for primary button |
| Lime 500 | `$sf-lime-500` | `#84cc16` | **Primary brand / CTA button** |
| Lime 600 | `$sf-lime-600` | `#65a30d` | Active state / text on lime |
| Lime 700 | `$sf-lime-700` | `#4d7c0f` | Dark lime text |

> **Rule:** Lime is used exclusively on primary CTAs, active nav indicators, and focus rings on lime-accented surfaces. Never use lime as body text or on form inputs.

### 2.3 Interactive / Primary Blue

| Token | SCSS var | Hex | Use |
|---|---|---|---|
| Blue 500 | `$sf-blue-500` | `#3b82f6` | `--sf-primary` / hover |
| Blue 600 | `$sf-blue-600` | `#2563eb` | `--sf-primary-hover` / focus outline |
| Blue 700 | `$sf-blue-700` | `#1d4ed8` | Active state |

> **Rule:** Blue is used for interactive elements inside the builder and settings (inputs, links, WP component overrides). The topbar / navigation uses lime, not blue.

### 2.4 Semantic Colors

| Role | Token (CSS var) | Hex | Notes |
|---|---|---|---|
| Success | `--sf-success` → `$sf-lime-600` | `#65a30d` | Canonical success. Use lime — **not** green (`#16a34a`). |
| Success BG | `--sf-success-bg` → `$sf-stone-100` | `#f5f5f4` | Neutral light background for success states. |
| Danger | `--sf-error` → `$sf-red-600` | `#dc2626` | |
| Danger BG | `--sf-error-bg` → `$sf-red-50` | `#fef2f2` | |
| Warning | `--sf-warning` → `$sf-amber-500` | `#f59e0b` | |
| Warning BG | `--sf-warning-bg` → `$sf-amber-50` | `#fffbeb` | |
| AI / Pro accent | `$sf-violet-500` | `#8b5cf6` | Only for AI features and Pro badges |

### 2.5 Surface & Text Semantic Tokens (use in all component SCSS)

```scss
// Surfaces
--sf-surface          // #ffffff
--sf-surface-raised   // #ffffff
--sf-surface-sunken   // var(--sf-gray-50)
--sf-surface-hover    // var(--sf-gray-100)
--sf-bg               // var(--sf-gray-50)

// Text
--sf-text             // var(--sf-gray-900)
--sf-text-secondary   // var(--sf-gray-500)
--sf-text-tertiary    // var(--sf-gray-400)
--sf-text-muted       // var(--sf-gray-600)
--sf-text-heading     // var(--sf-gray-800)
--sf-text-inverse     // #ffffff

// Borders
--sf-border           // var(--sf-gray-200)
--sf-border-strong    // var(--sf-gray-300)
--sf-border-subtle    // var(--sf-gray-100)
```

---

## 3. Typography

### 3.1 Font Stack

| Role | Family | SCSS var | Use |
|---|---|---|---|
| **Sans (UI body)** | `Instrument Sans` → `-apple-system` → `Segoe UI` | `$sf-font-sans` | All body text, labels, buttons |
| **Serif (display)** | `DM Serif Display` → `IBM Plex Serif` → `Georgia` | `$sf-font-serif` | Page headings, marketing-style hero text |
| **Mono (code/technical)** | `JetBrains Mono` → `IBM Plex Mono` → `Consolas` | `$sf-font-mono` | Badges, monospaced data, code blocks |

> **Rule:** Never use Inter, Roboto, or system-ui as the primary font. Instrument Sans is the canonical sans.

### 3.2 Font Size Scale

| Token | SCSS var | Size |
|---|---|---|
| xs | `$font-size-xs` | 0.75rem (12px) |
| sm | `$font-size-sm` | 0.875rem (14px) |
| base | `$font-size-base` | 1rem (16px) |
| lg | `$font-size-lg` | 1.125rem (18px) |
| xl | `$font-size-xl` | 1.25rem (20px) |
| 2xl | `$font-size-2xl` | 1.5rem (24px) |
| 3xl | `$font-size-3xl` | 2rem (32px) |
| 4xl | `$font-size-4xl` | 2.5rem (40px) |

### 3.3 Utility Classes

```jsx
// Font-family helpers
<span className="sf-font-serif">Display heading</span>
<code className="sf-font-mono">Code block</code>
<p className="sf-font-sans">Body copy</p>
```

---

## 4. Spacing

Based on an **8 px grid**. Layout-level spacing uses the `$space-*` SCSS variables; component-internal spacing uses the `$sf-sp-*` token scale.

### Layout spacing (`$space-*` — for margins, padding between sections)

| Token | Value |
|---|---|
| `$space-1` | 0.5rem (8px) |
| `$space-2` | 1rem (16px) |
| `$space-3` | 1.5rem (24px) |
| `$space-4` | 2rem (32px) |
| `$space-5` | 2.5rem (40px) |
| `$space-6` | 3rem (48px) |
| `$space-8` | 4rem (64px) |
| `$space-10` | 5rem (80px) |

### Component spacing (`$sf-sp-*` — for gap, padding inside components)

| Token | Value |
|---|---|
| `$sf-sp-1` | 4px |
| `$sf-sp-2` | 8px |
| `$sf-sp-3` | 12px |
| `$sf-sp-4` | 16px |
| `$sf-sp-5` | 20px |
| `$sf-sp-6` | 24px |
| `$sf-sp-8` | 32px |

> **Canonical values: 4, 8, 12, 16, 20, 24, 32.** Do not use 5, 10, 15, 18, 22, etc.

---

## 5. Border Radius

| Token | SCSS var | Value | Use |
|---|---|---|---|
| Small | `$radius-sm` | 6px | Inputs, small chips |
| Medium | `$radius-md` | 8px | Cards (inner elements) |
| Large | `$radius-lg` | 12px | Cards, modals, panels |
| XL | `$radius-xl` | 16px | Large floating panels |
| Full | `$radius-full` | 9999px | Badges, toggle pills |

---

## 6. Shadows

| Token | SCSS var | Use |
|---|---|---|
| xs | `$shadow-xs` | Barely-visible depth |
| sm | `$shadow-sm` | Buttons, chips |
| md | `$shadow-md` | Dropdowns, popovers |
| lg | `$shadow-lg` | Modals |
| xl | `$shadow-xl` | Large panels |
| 2xl | `$shadow-2xl` | Floating dialogs |
| Lime | `$shadow-lime` | Focus ring on lime CTA buttons |
| Violet | `$shadow-violet` | AI feature cards |

All shadows use `rgba(0,0,0,...)` — never black or named colors.

---

## 7. Motion & Transitions

| Token | CSS var | Value | Use |
|---|---|---|---|
| Fast | `--transition-fast` | `150ms ease` | Hover micro-interactions |
| Base | `--transition-base` | `250ms ease` | Default transitions |
| Slow | `--transition-slow` | `350ms ease` | Panel open/close |
| Slower | `--transition-slower` | `500ms ease` | Complex reveals |

Named motion roles (use these in component SCSS):
```scss
--motion-hover:  150ms cubic-bezier(0.4, 0, 0.2, 1);  // icon/button hover
--motion-panel:  200ms cubic-bezier(0.4, 0, 0.2, 1);  // panel open/close
--motion-slide:  250ms cubic-bezier(0.4, 0, 0.2, 1);  // slide transitions
--motion-toast:  250ms cubic-bezier(0.16, 1, 0.3, 1); // toast spring-in
```

> **Rule:** Do not use `transition: all`. Always name the specific property being transitioned.

---

## 8. Z-Index Layers

| Layer | SCSS var | Value |
|---|---|---|
| Base | `$z-base` | 1 |
| Dropdown | `$z-dropdown` | 1000 |
| Sticky | `$z-sticky` | 1020 |
| Fixed | `$z-fixed` | 1030 |
| Modal overlay | `$z-modal-overlay` | 100000 |
| Modal | `$z-modal` | 100001 |
| Popover | `$z-popover` | 100002 |
| Tooltip | `$z-tooltip` | 1000000 |
| WP admin bar | `$z-admin-bar` | 99999 |

---

## 9. Layout Tokens (Builder)

```scss
--sf-topbar-height:          48px
--sf-sidebar-width-left:     320px
--sf-sidebar-width-right:    360px
--sf-inspector-width:        360px
```

---

## 10. Component Patterns

### 10.1 Buttons

```jsx
// Primary CTA — lime background
<button className="sf-btn sf-btn--primary">Save</button>

// Secondary — outlined stone
<button className="sf-btn sf-btn--secondary">Cancel</button>

// Ghost — transparent, bordered
<button className="sf-btn sf-btn--ghost">More</button>

// Danger — destructive action
<button className="sf-btn sf-btn--danger">Delete</button>

// AI / Pro — violet gradient
<button className="sf-btn sf-btn--ai">Generate with AI</button>

// Sizes
<button className="sf-btn sf-btn--primary sf-btn--sm">Small</button>
<button className="sf-btn sf-btn--primary sf-btn--lg">Large</button>
<button className="sf-btn sf-btn--primary sf-btn--icon"><Icon.Plus /></button>
```

**Rules:**
- Primary button = lime. One per view.
- Secondary / ghost for cancel/back.
- Danger only for destructive/irreversible actions.
- Violet (`sf-btn--ai`) only for AI-powered features.

### 10.2 Badges

```jsx
// Status badges — use data-status attribute
<span className="sf-badge" data-status="new">New</span>
<span className="sf-badge" data-status="read">Read</span>
<span className="sf-badge" data-status="archived">Archived</span>
<span className="sf-badge" data-status="spam">Spam</span>

// Type badges
<span className="sf-badge" data-type="ai">Pro AI</span>
<span className="sf-badge" data-type="success">Active</span>
<span className="sf-badge" data-type="warning">Pending</span>
<span className="sf-badge" data-type="error">Error</span>

// With dot indicator
<span className="sf-badge sf-badge--dot" data-status="new">3 new</span>
```

Badges always use `font-family: var(--font-mono)`, `font-size: 12px`, `font-weight: 600`, `text-transform: uppercase`.

### 10.3 Toggle Switch

```jsx
<label className="sf-toggle">
  <input type="checkbox" checked={enabled} onChange={...} />
  <span className="sf-toggle__slider" />
</label>
```

Checked state = `$sf-lime-500`. Focus ring = `rgba(132, 204, 22, 0.15)`.

### 10.4 Loading States

```jsx
// Skeleton placeholder
<div className="sf-skeleton" style={{ height: 20, width: 120 }} />

// Pulsing opacity
<div className="sf-pulse">Loading...</div>

// Spinning icon
<Icon.Loader2 className="sf-spin" size={16} />
```

### 10.5 PanelSection (collapsible)

```jsx
import PanelSection from '../components/ui/PanelSection';

<PanelSection title="Advanced Options" initialOpen={false} variant="subtle">
  {/* content */}
</PanelSection>
```

### 10.6 Icons

All icons **must** be imported from `components/ui/Icon.jsx`, never directly from `lucide-react`.

```jsx
import Icon from '../components/ui/Icon';

<Icon.Plus size={16} />
<Icon.Mail size={20} className="sf-icon" />
```

The `.sf-icon` utility class forces `color: currentColor` on the SVG.

---

## 11. SCSS Scope & Import Rules

- All component SCSS lives **co-located** with the component (e.g. `FormsList.scss` next to `FormsList.jsx`).
- All component SCSS is imported in `resources/admin/styles/admin.scss` — nowhere else.
- Component SCSS must `@use 'variables' as *` or `@use 'tokens' as *` to access design tokens.
- **Never** write raw hex values in component SCSS. Always use a SCSS variable or CSS custom property.
- All rules must be scoped inside `.subtleforms-admin { ... }` to prevent WordPress admin bleed.

### SCSS import order in `admin.scss`
1. `_accessibility.scss` (WCAG foundation)
2. `_variables.scss` → `_tokens.scss` (design primitives)
3. `_design-system.scss` (CSS custom properties + utility classes)
4. `_interactions.scss` (transition polish)
5. UI system components
6. Feature components
7. Modals
8. Pages
9. Builder components

---

## 12. WordPress Compatibility Notes

- Tailwind prefix is `sf-` (e.g. `sf-bg-primary`). The plugin uses utility classes for one-off helpers; component styling is SCSS-based.
- `preflight: false` — Tailwind does **not** reset base HTML styles.
- WP palette variables (`--wp-blue-500`, `--wp-gray-30`, etc.) are available inside `.subtleforms-admin` but should only be used when a WP component requires them. Use SubtleForms tokens everywhere else.
- `@wordpress/components` (`Button`, `Modal`, `CheckboxControl`, etc.) are the correct choice for all admin UI that needs to feel native to WP. SubtleForms custom components are used when WP components lack needed behavior.
- Do not import `@wordpress/element` and React simultaneously — use `@wordpress/element` only.

---

## 13. Do / Don't Quick Reference

| ✅ Do | ❌ Don't |
|---|---|
| Use `$sf-stone-*` for neutral text and borders | Use `$sf-gray-*` for neutral UI (gray is for builder internals) |
| Use `$sf-lime-500` for the primary CTA | Use lime for links, body text, or inputs |
| Use `--sf-success` (`lime-600 #65a30d`) for positive/success states | Use green (`#16a34a`, `#059669`) — green is not a brand color |
| Import icons via `Icon.jsx` only | Import from `lucide-react` directly |
| Scope all SCSS inside `.subtleforms-admin` | Write global SCSS rules |
| Use `$sf-sp-*` for component-internal spacing | Use arbitrary pixel values |
| Use named motion vars (`--motion-hover`) | Use `transition: all 0.3s` |
| Add new component SCSS to `admin.scss` import list | Import component SCSS inside JSX |
| Use `clsx()` for conditional class merging | String concatenation for classNames |
| Font: `Instrument Sans` → `sf-font-sans` | Use Inter, Roboto, or system-ui |

---

## 14. File Locations

| Asset | Path |
|---|---|
| SCSS variables (colors, fonts, spacing, shadows) | `resources/admin/styles/_variables.scss` |
| Semantic token SCSS vars | `resources/admin/styles/_tokens.scss` |
| CSS custom properties + utility classes | `resources/admin/styles/_design-system.scss` |
| Interaction polish (focus, hover, transitions) | `resources/admin/styles/_interactions.scss` |
| Main SCSS aggregator | `resources/admin/styles/admin.scss` |
| Icon library | `resources/admin/components/ui/Icon.jsx` |
| PanelSection (collapsible) | `resources/admin/components/ui/PanelSection.jsx` |
| Upgrade prompt | `resources/admin/components/ui/UpgradePrompt.jsx` |
| Accessibility utilities | `resources/admin/scss/_accessibility.scss` |
