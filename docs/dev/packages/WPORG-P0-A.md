# WPORG-P0-A — Remove arbitrary Custom CSS (Free)

**Owning repo:** SubtleForms Free  
**Branch:** `pkg/wporg-p0-remove-custom-css` (from `main`)  
**Release target:** next Free release prepared for WordPress.org  

## Goal

Completely remove freeform Custom CSS from Free so the distributed plugin has no mechanism to enter, save, or render arbitrary user-supplied CSS. Required for WordPress.org compliance.

This is a WordPress.org P0 package, not a ledger bug-ID package. Do not invent bug IDs.

## In scope

- Remove builder Custom CSS editor and `canCustomCss` gating
- Remove Appearance schema `customCss`, sanitize helpers, and repository previous-CSS logic
- Remove frontend `CustomCssStyle` / `scopeCustomCss` rendering path
- Strip `customCss` on appearance sanitize so save/import/duplicate cannot persist new arbitrary CSS
- Ignore legacy `customCss` keys in stored JSON (never render; no destructive DB migration)
- Regression tests for sanitize, render, and structured appearance preservation

## Out of scope

- Migration, export, upgrade notices, or legacy preservation systems
- Pro or License Server code changes
- Version bumps, readme Stable Tag, POT
- Changes to structured appearance tokens, presets, colours, fonts, spacing

## Acceptance

1. Distributed Free cannot enter, save, or render arbitrary user-supplied CSS.
2. Structured appearance still works.
3. Forms still function.
4. Import/duplicate do not reactivate rendering of arbitrary CSS.
