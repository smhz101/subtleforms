# SubtleForms – Freeze Point

**Tag:** v1.5.0-freeze-admin-ui-audit  
**Date:** 2026-01-15

## Purpose

This snapshot represents the last known working state of SubtleForms
before starting a major Admin UI and layout refactor.

Key areas pending refactor:

- AdminShell scroll ownership
- Builder canvas + field deck scrolling
- SCSS / JSX class normalization
- Removal of Tailwind-style utility classes
- Settings page redesign (AdminShell alignment)
- Captcha UX integration in settings & builder

## Reset Instructions

To return to this exact state:

```bash
git checkout v1.5.0-freeze-admin-ui-audit
```

Or create a new branch from it:

```bash
git checkout -b recovery-from-freeze v1.5 0-freeze-admin-ui-audit
```

#### Notes

- Plugin version remains 1.5.0
- This tag is NOT a public release
- Safe rollback anchor for all admin UI work
