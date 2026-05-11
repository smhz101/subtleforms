# Security Policy

## Supported versions

| Version | Security updates |
| ------- | ---------------- |
| 1.8.x   | ✓ Active         |
| 1.7.x   | ✓ Active         |
| 1.6.x   | ✗ End of life    |
| < 1.6   | ✗ End of life    |

## Reporting a vulnerability

**DO NOT** report security vulnerabilities through public GitHub issues, pull requests, or the WordPress.org support forum.

### Option 1 — GitHub private disclosure (preferred)

Use GitHub's built-in private vulnerability reporting:

**[Report a vulnerability →](../../security/advisories/new)**

This creates a private advisory visible only to maintainers. GitHub's security tooling notifies the team immediately.

### Option 2 — Email

Send a report to: **security@subtleforms.com**

Encrypt your report using the PGP key published at [subtleforms.com/security.asc](https://subtleforms.com/security.asc) *(if available)*.

### What to include

1. **Description** — clear description of the vulnerability
2. **Impact** — what an attacker could achieve
3. **Steps to reproduce** — detailed and reproducible
4. **Affected versions** — which versions are impacted
5. **Proof of concept** — code or screenshots (no live exploits)
6. **Suggested fix** — optional, but appreciated

## Response timeline

| Stage | Target |
|-------|--------|
| Initial acknowledgement | 48 hours |
| Severity assessment | 5 business days |
| Fix development | Depends on severity (see below) |
| Public disclosure | After patch is released and users have time to update |

## Severity and response targets

| Severity | Examples | Patch target |
|----------|---------|--------------|
| **Critical** | RCE, SQL injection with data exfil, auth bypass | 24–72 hours |
| **High** | Privilege escalation, significant data exposure | 7 days |
| **Medium** | XSS, CSRF, limited information disclosure | Next minor version (2–4 weeks) |
| **Low** | Edge-case info leakage, minor hardening | Next major version |

## Coordinated disclosure

We follow a coordinated disclosure policy:

1. You report privately.
2. We confirm, assess severity, and develop a fix.
3. We release the patched version.
4. We publish a security advisory crediting you (if desired).
5. We aim to disclose within 90 days of your report.

If you intend to publish independently, please give us at least 90 days from initial report.

## Security features

SubtleForms includes:

- **Nonce verification** — all REST API and AJAX requests verified
- **Capability checks** — `manage_options` required for all admin actions
- **Input sanitization** — deep array and JSON sanitization throughout
- **Output escaping** — context-aware escaping (`esc_html`, `esc_attr`, `esc_url`, etc.)
- **SQL injection prevention** — `$wpdb->prepare()` for all dynamic queries
- **Rate limiting** — IP-based rate limiting on public submission endpoint
- **Spam protection** — honeypot, timing validation, CAPTCHA support
- **CSRF protection** — nonce verification on all state-changing endpoints
- **Direct file access guard** — `ABSPATH` check in all PHP entry points

## Scope

In scope for responsible disclosure:
- Authentication and authorization bypasses
- SQL injection
- Cross-site scripting (XSS) in admin or frontend
- CSRF on privileged operations
- Remote code execution
- Sensitive data exposure (submission data, settings, keys)
- Privilege escalation

Out of scope:
- Spam submissions to public forms (use CAPTCHA and rate limiting settings)
- Vulnerabilities in WordPress core, themes, or other plugins
- Denial-of-service attacks
- Issues requiring physical access to the server

## Bug bounty

We do not currently have a formal bug bounty program. We acknowledge responsible disclosures in our release notes and maintain a hall of fame.

## Hall of fame

*(No entries yet — be the first!)*

## Questions?

For general security questions (non-vulnerability), open a GitHub Discussion. For urgent security concerns, always use email: **security@subtleforms.com**.
