# WPORG-P0-B — Onboarding send-test-email authorization

**Owning repo:** SubtleForms Free
**Branch:** `pkg/wporg-p0-onboarding-auth` (from Package A tip / release line for WordPress.org)
**Release target:** next Free release prepared for WordPress.org

## Goal

Tighten `POST /subtleforms/v1/onboarding/send-test-email` so only administrators can trigger an email to the site admin address. WordPress.org finding: `edit_posts` let non-admins email the administrator.

This is a WordPress.org P0 package, not a ledger bug-ID package. Do not invent bug IDs.

## In scope

- Dedicated administrator permission callback for send-test-email (`manage_options` plus REST nonce)
- Keep recipient as Settings::getAdminEmail() / site admin (caller cannot choose destination)
- Regression tests for roles, unauthenticated, invalid nonce, no mail on denial, and other onboarding routes unchanged

## Out of scope

- Changing dismiss / tour / create-wizard / more-features caps (shared `edit_posts` write gate stays)
- Throttling unless clearly justified
- Free–Pro CONTRACT, version bumps, Pro / License Server

## Acceptance

1. Administrator with `manage_options` and a valid REST nonce can call send-test-email.
2. Editor, Author, Contributor, Subscriber, and unauthenticated callers are denied.
3. Missing or invalid nonce is denied for authenticated REST context.
4. Denied requests never dispatch mail.
5. Other onboarding write routes still use their intended `edit_posts` callback.
