# Security Policy

## Supported Versions

We actively support the following versions of SubtleForms with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 1.8.x   | :white_check_mark: |
| 1.7.x   | :white_check_mark: |
| 1.6.x   | :x:                |
| < 1.6   | :x:                |

## Reporting a Vulnerability

We take the security of SubtleForms seriously. If you believe you have found a security vulnerability, please report it to us responsibly.

### How to Report

**DO NOT** report security vulnerabilities through public GitHub issues.

Instead, please report them via email to:

**security@subtleforms.com**

### What to Include

Please include the following information in your report:

1. **Description:** Clear description of the vulnerability
2. **Impact:** What an attacker could achieve
3. **Steps to Reproduce:** Detailed steps to reproduce the issue
4. **Affected Versions:** Which versions are impacted
5. **Proof of Concept:** Code or screenshots demonstrating the issue
6. **Suggested Fix:** If you have ideas for a fix (optional)

### Example Report

```
Subject: [SECURITY] XSS Vulnerability in Form Builder

Description:
Cross-site scripting vulnerability in the form name field allows
arbitrary JavaScript execution in the WordPress admin.

Impact:
An authenticated user with form editing permissions could execute
JavaScript in the context of other users' browsers.

Steps to Reproduce:
1. Create a new form
2. Set form name to: <script>alert(1)</script>
3. Save form
4. Open form list page
5. JavaScript executes

Affected Versions:
1.8.0 and earlier

Proof of Concept:
[Screenshot or code sample]

Suggested Fix:
Escape form name output using esc_html() or wp_kses()
```

## Response Timeline

We aim to respond to security reports according to the following timeline:

- **Initial Response:** Within 48 hours
- **Confirmation:** Within 5 business days
- **Fix Development:** Varies based on severity
- **Public Disclosure:** After patch is released

## Severity Levels

We classify vulnerabilities using the following severity levels:

### Critical

- **Impact:** Complete system compromise
- **Examples:** Remote code execution, SQL injection with data access
- **Response:** Emergency patch within 24-72 hours

### High

- **Impact:** Significant data breach or privilege escalation
- **Examples:** Authentication bypass, data exposure
- **Response:** Patch within 7 days

### Medium

- **Impact:** Limited data exposure or functionality compromise
- **Examples:** XSS, CSRF, information disclosure
- **Response:** Patch in next minor version (typically 2-4 weeks)

### Low

- **Impact:** Minimal security risk
- **Examples:** Minor information disclosure, edge case vulnerabilities
- **Response:** Patch in next major version

## Coordinated Disclosure

We follow a coordinated disclosure policy:

1. **Private Disclosure:** You report the vulnerability privately
2. **Fix Development:** We develop and test a fix
3. **Patch Release:** We release a security update
4. **Public Disclosure:** We publish a security advisory
5. **Credit:** We credit you in the advisory (if desired)

### Disclosure Timeline

- We aim to patch critical vulnerabilities within 90 days
- We will work with you to agree on a disclosure date
- If you plan to publish independently, please give us at least 90 days

## Security Updates

Security updates are released as:

- **Minor Versions:** For high/critical vulnerabilities (e.g., 1.8.0 → 1.8.1)
- **Major Versions:** For lower severity issues bundled with other changes

### Applying Updates

We strongly recommend:

1. **Enable automatic updates** for minor versions
2. **Subscribe to security notifications** (coming soon)
3. **Test updates** in a staging environment first
4. **Keep WordPress core** updated as well

## Security Best Practices

### For Users

- Keep SubtleForms updated to the latest version
- Use strong WordPress admin passwords
- Limit form editing permissions to trusted users
- Use HTTPS for your WordPress site
- Keep WordPress core and other plugins updated
- Regular backups of your WordPress database

### For Developers

- Review the [Secure Coding Guidelines](docs/secure-coding.md)
- Sanitize all user input
- Escape all output
- Use nonces for form submissions
- Check user capabilities before actions
- Validate file uploads carefully
- Use prepared SQL statements
- Never trust client-side data

## Known Vulnerabilities

We maintain a public list of disclosed vulnerabilities:

[https://github.com/subtleforms/security-advisories](https://github.com/subtleforms/security-advisories)

### Recent Advisories

None at this time.

## Security Features

SubtleForms includes the following security features:

- **Nonce Verification:** All AJAX requests verified
- **Capability Checks:** Actions restricted by user permissions
- **Input Sanitization:** All user input sanitized
- **Output Escaping:** All output escaped for context
- **SQL Injection Prevention:** Prepared statements used
- **File Upload Validation:** File types and sizes checked
- **CSRF Protection:** Cross-site request forgery prevention
- **XSS Prevention:** Script injection prevented

## Third-Party Dependencies

SubtleForms uses the following third-party libraries:

- React (MIT License)
- TanStack Query (MIT License)
- WordPress APIs (GPLv2)

We monitor these dependencies for security vulnerabilities and update them promptly.

## Bug Bounty Program

We currently do not have a bug bounty program, but we:

- Acknowledge security researchers in our release notes
- Provide CVE credits when applicable
- Maintain a hall of fame for responsible disclosures

## Hall of Fame

Thank you to these security researchers for responsible disclosure:

*(No entries yet)*

## Security Audit

SubtleForms has not yet undergone a third-party security audit. If you are interested in sponsoring an audit, please contact us.

## Compliance

SubtleForms is designed with the following compliance considerations:

- **GDPR:** Personal data handling follows privacy regulations
- **WordPress.org Guidelines:** Complies with plugin repository rules
- **OWASP Top 10:** Mitigations for common web vulnerabilities

## Questions?

For general security questions (non-vulnerabilities), you can:

- Open a GitHub Discussion
- Email: security@subtleforms.com (for security-related questions only)
- Review our [Security Documentation](docs/security.md)

For immediate security concerns, always email security@subtleforms.com.

Thank you for helping keep SubtleForms secure!
