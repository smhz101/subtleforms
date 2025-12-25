# Testing Documentation

## Backend Tests (PHPUnit)

We use PHPUnit for backend testing. The tests are located in the `tests/` directory.

### Prerequisites

- PHP 7.4+
- Composer
- WP-CLI
- A local MySQL database for testing (e.g., `subtleforms_test`)

### Setup

1. Install dependencies:

   ```bash
   composer install
   ```

2. Install the WordPress test environment (if not already done):
   ```bash
   bash bin/install-wp-tests.sh <db-name> <db-user> <db-pass> [db-host] [wp-version]
   ```
   Example:
   ```bash
   bash bin/install-wp-tests.sh subtleforms_test root root localhost latest
   ```

### Running Tests

Run the tests using Composer:

```bash
composer test
```

Or directly via PHPUnit:

```bash
vendor/bin/phpunit
```

### Test Structure

- `tests/test-forms-repository.php`: Tests for form persistence (CRUD).
- `tests/test-submissions-repository.php`: Tests for submission handling.

## Frontend Tests (Jest)

_Coming soon..._

## E2E Tests (Playwright)

_Coming soon..._
