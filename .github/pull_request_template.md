## Summary

<!-- Describe what this PR does and why. One paragraph is fine. -->

## Type of change

<!-- Check all that apply. -->

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that changes existing behavior)
- [ ] Refactor (no functional change, code quality improvement)
- [ ] Performance improvement
- [ ] Documentation update
- [ ] CI / tooling change
- [ ] Dependency update

## WordPress.org impact

<!-- Check any that apply. These affect the WordPress.org submission review. -->

- [ ] I updated `readme.txt` changelog for this change
- [ ] The `Stable tag` in `readme.txt` matches the plugin `Version` header (if this is a release)
- [ ] No new GPL-incompatible dependencies introduced
- [ ] No obfuscated or minified code added without a readable source
- [ ] No calls to external services without user consent/disclosure
- [ ] No hardcoded admin URLs or plugin paths that break on non-standard installs
- [ ] N/A — this change does not affect the WordPress.org package

## Security checklist

<!-- Check all that apply to any PHP/server-side changes. -->

- [ ] All user input is sanitized (`sanitize_text_field`, `absint`, `wp_kses`, etc.)
- [ ] All output is escaped (`esc_html`, `esc_attr`, `esc_url`, `wp_json_encode`, etc.)
- [ ] Nonce verification added/preserved for all form submissions and AJAX requests
- [ ] Capability check (`current_user_can`) added/preserved for all privileged actions
- [ ] SQL queries use `$wpdb->prepare()` or direct table methods — no raw interpolation
- [ ] No secrets, API keys, or credentials committed
- [ ] N/A — this change has no security-relevant PHP

## Testing notes

<!-- How was this tested? Include WP version, PHP version, and browser if relevant. -->

**Tested on:**
- WordPress:
- PHP:
- Browser (if UI change):

**Test steps:**

1.
2.
3.

**Edge cases considered:**

-

## Screenshots

<!-- Include before/after screenshots for any UI change. Delete this section if not applicable. -->

| Before | After |
|--------|-------|
|        |       |
