# SubtleForms

SubtleForms is a form builder for WordPress. Forms are built on a visual canvas that looks like the published form, can be regular, multi-step or conversational, and every entry is read in an inbox inside wp-admin. The plugin works without an account or a licence key.

- WordPress.org: [wordpress.org/plugins/subtleforms](https://wordpress.org/plugins/subtleforms/)
- Website and documentation: [subtleforms.com](https://subtleforms.com/) and [subtleforms.com/docs](https://subtleforms.com/docs/)
- Support forum: [wordpress.org/support/plugin/subtleforms](https://wordpress.org/support/plugin/subtleforms/)
- Bug reports: [GitHub issues](https://github.com/smhz101/subtleforms/issues)

This repository contains the source of the free plugin published on WordPress.org.

## Contents

- [Features](#features)
- [Requirements](#requirements)
- [Installation](#installation)
- [Usage](#usage)
- [Development](#development)
- [Project structure](#project-structure)
- [Extending SubtleForms](#extending-subtleforms)
- [Releases](#releases)
- [Contributing](#contributing)
- [Security](#security)
- [Privacy and external services](#privacy-and-external-services)
- [SubtleForms Pro](#subtleforms-pro)
- [License](#license)

## Features

### Building forms

- Visual drag and drop builder with a live canvas, a field library and a settings panel for each field (Settings, Validation, Logic and Style), with undo and redo.
- Three form types from one builder: regular, multi-step and conversational (one question at a time). A form can switch type without being rebuilt.
- Twelve ready-made templates and a blank form.
- Field widths for placing fields side by side.
- Appearance presets, or custom colours and fonts that start from the active theme, with a compact or comfortable density and contrast warnings.
- Desktop, tablet and mobile preview.

### Fields

| Group | Field types |
| --- | --- |
| Basic | Text, Paragraph, Email, Number, Phone, Website, Name, Address, Password |
| Choices | Dropdown, Radio buttons, Checkboxes, Single checkbox, Toggle, Country, Chained select, Consent |
| Date, time and more | Date, Time, Date and time, Rating, Opinion scale, NPS, Slider, Matrix, Colour picker, Rich text, Hidden |
| Uploads | File and image uploads with allowed types and size limits, stored in a private folder |
| Layout | Section heading, Custom HTML, Notice, Page break, Repeater |
| Spam protection | reCAPTCHA, hCaptcha, Cloudflare Turnstile |

### Logic and after submission

- Conditional logic that shows or hides a field when its rules match, enforced in the browser and on the server. Hidden fields are neither validated nor saved.
- Email notifications with merge tags such as `{all_fields}` and `{field:email}`, in plain text or HTML.
- Webhooks after each entry, with a test button.
- A confirmation message or a redirect after submission.
- Availability rules: open and close dates, entry limits and logged-in visitors only.

### Entries

- An inbox with tabs, search, filters and a reading pane.
- Read and unread, stars, flags, notes, resend notifications and a Trash, for one entry or in bulk.
- The number of unread entries shown in the WordPress admin menu.
- Reports with a chart of recent submissions.
- CSV export of entries, and JSON export and import of forms and entries.
- Import of forms from Contact Form 7, Gravity Forms and Fluent Forms, from the same site or from an export file.

### Spam protection and privacy

- Honeypot, minimum completion time and rate limiting on every form.
- Optional Google reCAPTCHA (v2 and v3), hCaptcha or Cloudflare Turnstile.
- Data retention settings and support for the WordPress personal data export and erase tools.
- No telemetry and no external requests unless the site owner enables a service.

### Performance and accessibility

- Front-end scripts and styles load only on pages that contain a form, and the code for a field type loads only when a form uses it.
- Forms are printed with their data in the page, so they render without a loading flash.
- Labelled fields, keyboard support and an RTL stylesheet. All strings are translatable.

## Requirements

| Component | Version |
| --- | --- |
| WordPress | 6.6 or later |
| PHP | 8.1 or later |
| Database | A MySQL or MariaDB version supported by WordPress |
| Node.js (development only) | 20 or later |
| Composer (development only) | 2 |

## Installation

### From WordPress.org

1. In wp-admin, go to Plugins, Add New Plugin.
2. Search for "SubtleForms", then click Install Now and Activate.

Updates are delivered through the WordPress updater.

### From a release zip

1. Download the plugin zip from the [WordPress.org plugin page](https://wordpress.org/plugins/subtleforms/).
2. In wp-admin, go to Plugins, Add New Plugin, Upload Plugin, and choose the zip.
3. Activate the plugin.

### From source

```bash
git clone https://github.com/smhz101/subtleforms.git
cd subtleforms
composer install --no-dev
npm ci
npm run build:all
```

Copy or symlink the folder into `wp-content/plugins/subtleforms`, then activate it. The folder must be named `subtleforms`.

## Usage

1. Go to SubtleForms, Add New, and start from a template or a blank form.
2. Add and arrange fields on the canvas, then configure each field in the settings panel.
3. Set notifications, confirmation and availability under the form's Settings tab.
4. Publish the form.
5. Add it to a page with the SubtleForms block, or with the shortcode shown in SubtleForms, All Forms:

```text
[subtleforms id="123"]
```

Entries appear in SubtleForms, Submissions.

## Development

### Setup

```bash
git clone https://github.com/smhz101/subtleforms.git
cd subtleforms
composer install
npm ci
npm run build:all
```

During development, `npm run start` rebuilds the admin app on change. `npm run start:frontend` and `npm run start:block` do the same for the front end and the block.

A local WordPress site is needed to run the plugin. The repository includes a `.wp-env.json` for [@wordpress/env](https://www.npmjs.com/package/@wordpress/env):

```bash
npx @wordpress/env start
```

### Building

| Command | Result |
| --- | --- |
| `npm run build:all` | Builds the admin app, the front end, the block, the flag images and the third-party notices |
| `npm run size` | Checks the bundles against the size budget in `bin/bundle-budget.json` |

### Tests and checks

| Command | What it runs |
| --- | --- |
| `composer test` | PHP unit tests |
| `WP_LOAD=/path/to/wp-load.php vendor/bin/phpunit -c phpunit-wp.xml.dist` | PHP tests inside a WordPress install |
| `npm test` | JavaScript unit tests (Jest) |
| `npm run lint:js` | ESLint |
| `npm run test:browser` | Browser tests (Playwright) against a running site |

Every pull request runs these checks in GitHub Actions, together with WordPress Plugin Check and a translation template check. A pull request is merged only when every check passes.

## Project structure

| Path | Contents |
| --- | --- |
| `subtleforms.php` | Plugin bootstrap and version |
| `src/` | PHP source: REST API, form engine, validation, fields, entries, importers |
| `resources/admin/` | React admin app: builder, forms list, entries inbox, reports, settings |
| `resources/frontend/` | Front-end form renderer |
| `resources/blocks/form/` | The SubtleForms block |
| `templates/` | PHP templates for admin screens and emails |
| `build/` | Compiled assets (generated, not committed) |
| `languages/` | Translation templates |
| `tests/` | PHP, JavaScript and browser tests |
| `docs/` | Developer documentation |
| `.wordpress-org/` | WordPress.org directory assets: icon, banners and screenshots |

## Extending SubtleForms

SubtleForms exposes PHP hooks and JavaScript extension points for field types, conditional logic, submission handling, settings tabs, admin screen slots and branding. Add-ons integrate through these documented APIs only.

- [docs/hooks.md](docs/hooks.md): the full list of actions, filters, slots and JavaScript APIs, with arguments and examples.
- [docs/migrate.md](docs/migrate.md): how the importers map forms from other plugins.

## Releases

Each release is prepared in a `release/<version>` pull request that sets the version, compiles the changelog from the fragments in `docs/dev/changes/unreleased/` and regenerates the translation templates. The process is described in [docs/dev/RELEASING.md](docs/dev/RELEASING.md). The release history is in [changelog.txt](changelog.txt).

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. In short:

- Create a branch from `main` and keep each pull request to one change.
- Add or update tests for every fix and feature.
- Add a changelog fragment in `docs/dev/changes/unreleased/` for user-visible changes.
- Follow the WordPress coding standards for PHP and the repository's ESLint configuration for JavaScript.

## Security

Please do not report security issues in public issues or the support forum. Use GitHub's [private vulnerability reporting](https://github.com/smhz101/subtleforms/security/advisories/new) or the contact described in [SECURITY.md](SECURITY.md).

## Privacy and external services

SubtleForms stores the answers a visitor submits, the submission time, and the visitor's IP address and browser user agent for spam checks. Retention can be configured, and entries can be exported or erased with the WordPress privacy tools.

The plugin makes no external requests by default. A CAPTCHA provider is contacted only when the site owner enables one, and webhooks send data only to URLs the site owner enters. The services, the data sent and their terms are listed in the External services section of [readme.txt](readme.txt).

## SubtleForms Pro

SubtleForms Pro is a separate plugin, available at [subtleforms.com/pro](https://subtleforms.com/pro/), that adds further fields, payments and integrations through the extension points described above. It is not part of this repository, and the free plugin is fully functional without it.

## License

SubtleForms is free software released under the GNU General Public License, version 2 or later. See [license.txt](license.txt). Third-party components and their licenses are listed in the `THIRD-PARTY-NOTICES.txt` file included in each release.
