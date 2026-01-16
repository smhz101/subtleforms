# SubtleForms Testing Skills

## Testing Strategy: Pragmatic Coverage

SubtleForms uses **PHPUnit** for backend testing and focuses on **critical business logic** rather than 100% coverage.

## Core Principles

### 1. Test Business Logic, Not Boilerplate
✅ **DO test:**
- Repositories (CRUD operations, query logic)
- Validators (input validation rules)
- Spam protection engine (honeypot, time trap, rate limiting)
- Form submission pipeline (data transformation, storage)
- Email delivery (template rendering, recipient handling)

❌ **DON'T test:**
- WordPress hooks/filters (trust WordPress)
- Getter/setter methods
- Simple property assignments
- Constructor dependency injection
- Database schema migrations (test in staging)

### 2. Use In-Memory SQLite for Speed
Tests use SQLite in-memory database instead of MySQL for 10-100x faster execution.

### 3. Isolation Through Setup/Teardown
Each test creates fresh database state and cleans up after itself.

## Directory Structure

```
tests/
├── bootstrap.php                 # PHPUnit bootstrap
├── Unit/                        # Unit tests (no WordPress)
│   ├── Validators/
│   │   ├── EmailValidatorTest.php
│   │   └── FormValidatorTest.php
│   └── Support/
│       └── HelpersTest.php
├── Integration/                 # Integration tests (with WordPress)
│   ├── Repositories/
│   │   ├── FormsRepositoryTest.php
│   │   └── SubmissionsRepositoryTest.php
│   ├── Engine/
│   │   ├── SpamProtectionTest.php
│   │   └── SubmissionPipelineTest.php
│   └── Api/
│       ├── RestControllerTest.php
│       └── DashboardApiTest.php
└── Fixtures/
    ├── sample-form.json
    └── sample-submission.json
```

## PHPUnit Configuration

### phpunit.xml
```xml
<?xml version="1.0"?>
<phpunit
    bootstrap="tests/bootstrap.php"
    backupGlobals="false"
    colors="true"
    convertErrorsToExceptions="true"
    convertNoticesToExceptions="true"
    convertWarningsToExceptions="true"
    testdox="true"
>
    <testsuites>
        <testsuite name="unit">
            <directory>tests/Unit</directory>
        </testsuite>
        <testsuite name="integration">
            <directory>tests/Integration</directory>
        </testsuite>
    </testsuites>
    
    <filter>
        <whitelist processUncoveredFilesFromWhitelist="true">
            <directory suffix=".php">src</directory>
            <exclude>
                <directory>src/Views</directory>
                <file>src/Plugin.php</file>
            </exclude>
        </whitelist>
    </filter>
    
    <php>
        <env name="WP_TESTS_DIR" value="/tmp/wordpress-tests-lib"/>
        <env name="WP_CORE_DIR" value="/tmp/wordpress/"/>
    </php>
</phpunit>
```

## Test Examples

### Unit Test: Email Validator
```php
<?php

namespace SubtleForms\Tests\Unit\Validators;

use PHPUnit\Framework\TestCase;
use SubtleForms\Validators\EmailValidator;

class EmailValidatorTest extends TestCase {
    
    private EmailValidator $validator;
    
    protected function setUp(): void {
        $this->validator = new EmailValidator();
    }
    
    /** @test */
    public function it_validates_correct_email_addresses() {
        $this->assertTrue($this->validator->validate('test@example.com'));
        $this->assertTrue($this->validator->validate('user+tag@domain.co.uk'));
    }
    
    /** @test */
    public function it_rejects_invalid_email_addresses() {
        $this->assertFalse($this->validator->validate('invalid'));
        $this->assertFalse($this->validator->validate('@example.com'));
        $this->assertFalse($this->validator->validate('test@'));
    }
    
    /** @test */
    public function it_handles_disposable_email_detection() {
        $this->assertFalse($this->validator->validate('test@tempmail.com', [
            'block_disposable' => true
        ]));
    }
}
```

### Integration Test: Forms Repository
```php
<?php

namespace SubtleForms\Tests\Integration\Repositories;

use WP_UnitTestCase;
use SubtleForms\Repositories\FormsRepository;

class FormsRepositoryTest extends WP_UnitTestCase {
    
    private FormsRepository $repository;
    
    protected function setUp(): void {
        parent::setUp();
        
        global $wpdb;
        $this->repository = new FormsRepository($wpdb);
        
        // Create test table
        $this->repository->create_table();
    }
    
    protected function tearDown(): void {
        // Clean up test data
        global $wpdb;
        $wpdb->query("DROP TABLE IF EXISTS {$wpdb->prefix}subtleforms_forms");
        
        parent::tearDown();
    }
    
    /** @test */
    public function it_creates_a_form() {
        $form = $this->repository->create([
            'title' => 'Contact Form',
            'schema' => json_encode(['fields' => []]),
            'settings' => json_encode(['notifications' => true])
        ]);
        
        $this->assertIsArray($form);
        $this->assertEquals('Contact Form', $form['title']);
        $this->assertEquals('draft', $form['status']);
    }
    
    /** @test */
    public function it_finds_form_by_id() {
        $created = $this->repository->create([
            'title' => 'Test Form',
            'schema' => '{}',
            'settings' => '{}'
        ]);
        
        $found = $this->repository->find($created['id']);
        
        $this->assertIsArray($found);
        $this->assertEquals($created['id'], $found['id']);
        $this->assertEquals('Test Form', $found['title']);
    }
    
    /** @test */
    public function it_updates_form() {
        $form = $this->repository->create([
            'title' => 'Original Title',
            'schema' => '{}',
            'settings' => '{}'
        ]);
        
        $updated = $this->repository->update($form['id'], [
            'title' => 'Updated Title',
            'status' => 'published'
        ]);
        
        $this->assertTrue($updated);
        
        $found = $this->repository->find($form['id']);
        $this->assertEquals('Updated Title', $found['title']);
        $this->assertEquals('published', $found['status']);
    }
    
    /** @test */
    public function it_deletes_form() {
        $form = $this->repository->create([
            'title' => 'To Delete',
            'schema' => '{}',
            'settings' => '{}'
        ]);
        
        $deleted = $this->repository->delete($form['id']);
        $this->assertTrue($deleted);
        
        $found = $this->repository->find($form['id']);
        $this->assertNull($found);
    }
    
    /** @test */
    public function it_counts_forms_by_status() {
        $this->repository->create(['title' => 'Draft 1', 'schema' => '{}', 'settings' => '{}']);
        $this->repository->create(['title' => 'Draft 2', 'schema' => '{}', 'settings' => '{}']);
        $this->repository->create([
            'title' => 'Published',
            'schema' => '{}',
            'settings' => '{}',
            'status' => 'published'
        ]);
        
        $counts = $this->repository->get_counts();
        
        $this->assertEquals(2, $counts['draft']);
        $this->assertEquals(1, $counts['published']);
    }
}
```

### Integration Test: Spam Protection
```php
<?php

namespace SubtleForms\Tests\Integration\Engine;

use WP_UnitTestCase;
use SubtleForms\Engine\SpamProtection;
use SubtleForms\Support\Settings;

class SpamProtectionTest extends WP_UnitTestCase {
    
    private SpamProtection $spam_protection;
    private Settings $settings;
    
    protected function setUp(): void {
        parent::setUp();
        
        $this->settings = new Settings();
        $this->spam_protection = new SpamProtection($this->settings);
    }
    
    /** @test */
    public function it_detects_honeypot_spam() {
        $submission = [
            'fields' => [],
            'honeypot' => 'bot-filled-this'
        ];
        
        $result = $this->spam_protection->check($submission, 1);
        
        $this->assertTrue($result['is_spam']);
        $this->assertEquals('honeypot', $result['reason']);
    }
    
    /** @test */
    public function it_detects_time_trap_spam() {
        $submission = [
            'fields' => [],
            'render_time' => time() - 1 // Submitted 1 second after render
        ];
        
        $result = $this->spam_protection->check($submission, 1);
        
        $this->assertTrue($result['is_spam']);
        $this->assertEquals('time_trap', $result['reason']);
    }
    
    /** @test */
    public function it_allows_valid_submissions() {
        $submission = [
            'fields' => [],
            'render_time' => time() - 10 // Submitted 10 seconds after render
        ];
        
        $result = $this->spam_protection->check($submission, 1);
        
        $this->assertFalse($result['is_spam']);
        $this->assertNull($result['reason']);
    }
    
    /** @test */
    public function it_enforces_rate_limiting() {
        $ip = '192.168.1.1';
        
        // Simulate 11 requests in rapid succession
        for ($i = 0; $i < 11; $i++) {
            set_transient("subtleforms_rate_limit_{$ip}", time(), 60);
        }
        
        $result = $this->spam_protection->check_rate_limit($ip);
        
        $this->assertTrue($result['is_limited']);
        $this->assertEquals(60, $result['retry_after']);
    }
}
```

## Running Tests

### Run All Tests
```bash
./vendor/bin/phpunit
```

### Run Specific Suite
```bash
./vendor/bin/phpunit --testsuite=unit
./vendor/bin/phpunit --testsuite=integration
```

### Run Single Test File
```bash
./vendor/bin/phpunit tests/Integration/Repositories/FormsRepositoryTest.php
```

### Run Single Test Method
```bash
./vendor/bin/phpunit --filter it_creates_a_form
```

### With Coverage
```bash
./vendor/bin/phpunit --coverage-html coverage
```

## Test Fixtures

### Sample Form JSON
`tests/Fixtures/sample-form.json`:
```json
{
  "fields": [
    {
      "id": "field_1",
      "type": "text",
      "label": "Full Name",
      "required": true
    },
    {
      "id": "field_2",
      "type": "email",
      "label": "Email Address",
      "required": true
    },
    {
      "id": "field_3",
      "type": "textarea",
      "label": "Message",
      "required": false
    }
  ]
}
```

### Using Fixtures in Tests
```php
/** @test */
public function it_validates_form_schema() {
    $schema = json_decode(
        file_get_contents(__DIR__ . '/../Fixtures/sample-form.json'),
        true
    );
    
    $validator = new FormValidator();
    $result = $validator->validate($schema);
    
    $this->assertTrue($result['valid']);
}
```

## Mocking WordPress Functions

### Using Brain Monkey
```php
use Brain\Monkey\Functions;

/** @test */
public function it_sends_notification_email() {
    Functions\when('wp_mail')->justReturn(true);
    
    $notifier = new EmailNotifier();
    $result = $notifier->send([
        'to' => 'admin@example.com',
        'subject' => 'New Submission',
        'body' => 'Test message'
    ]);
    
    $this->assertTrue($result);
}
```

## Test Data Builders

### Form Builder
```php
<?php

namespace SubtleForms\Tests\Builders;

class FormBuilder {
    
    private array $data = [
        'title' => 'Test Form',
        'schema' => '{}',
        'settings' => '{}',
        'status' => 'draft'
    ];
    
    public function withTitle(string $title): self {
        $this->data['title'] = $title;
        return $this;
    }
    
    public function withStatus(string $status): self {
        $this->data['status'] = $status;
        return $this;
    }
    
    public function withFields(array $fields): self {
        $this->data['schema'] = json_encode(['fields' => $fields]);
        return $this;
    }
    
    public function build(): array {
        return $this->data;
    }
}
```

### Usage in Tests
```php
/** @test */
public function it_publishes_draft_form() {
    $form_data = (new FormBuilder())
        ->withTitle('Contact Form')
        ->withStatus('draft')
        ->build();
    
    $form = $this->repository->create($form_data);
    $this->repository->update($form['id'], ['status' => 'published']);
    
    $updated = $this->repository->find($form['id']);
    $this->assertEquals('published', $updated['status']);
}
```

## Continuous Integration

### GitHub Actions Workflow
`.github/workflows/tests.yml`:
```yaml
name: PHPUnit Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        php-version: ['7.4', '8.0', '8.1', '8.2']
        wordpress-version: ['6.0', '6.5', '6.7']
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup PHP
        uses: shivammathur/setup-php@v2
        with:
          php-version: ${{ matrix.php-version }}
          extensions: mysqli, mbstring
          coverage: xdebug
      
      - name: Install Composer dependencies
        run: composer install --prefer-dist --no-progress
      
      - name: Setup WordPress test environment
        run: |
          bash bin/install-wp-tests.sh wordpress_test root '' localhost ${{ matrix.wordpress-version }}
      
      - name: Run PHPUnit
        run: ./vendor/bin/phpunit --coverage-clover=coverage.xml
      
      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage.xml
```

## Common Assertions

### WordPress-Specific
```php
// User assertions
$this->assertUserCan($user, 'edit_forms');

// Post assertions
$this->assertPostExists($post_id);

// Query assertions
$this->assertQueryTrue('is_single', 'is_singular');
```

### Custom Assertions
```php
// Assert valid form schema
$this->assertValidFormSchema($schema);

// Assert submission stored
$this->assertSubmissionExists($form_id, $submission_data);

// Assert email sent
$this->assertEmailSent('admin@example.com');
```

## Test Coverage Goals

- **Repositories**: 90%+ (critical data layer)
- **Validators**: 95%+ (business rules)
- **Engine**: 85%+ (submission pipeline)
- **API Controllers**: 70%+ (integration layer)
- **Overall**: 75%+ (pragmatic balance)

## When NOT to Write Tests

❌ Skip tests for:
- WordPress core functions (trust WordPress)
- Third-party library wrappers
- Simple data structures (DTOs, models)
- View templates (test rendering manually)
- Database migrations (test in staging)
- Build scripts

## Test-Driven Development (Optional)

For critical features, consider TDD:

1. **Write failing test**
```php
/** @test */
public function it_enforces_submission_limit() {
    // Test that doesn't pass yet
    $this->assertTrue($this->spam_protection->check_submission_limit(1, 'user@example.com'));
}
```

2. **Implement minimal code**
```php
public function check_submission_limit(int $form_id, string $identifier): bool {
    // Minimal implementation
    return false;
}
```

3. **Make test pass**
```php
public function check_submission_limit(int $form_id, string $identifier): bool {
    $count = $this->repository->count_by_identifier($form_id, $identifier);
    $limit = $this->settings->get('submission_limit', 10);
    return $count >= $limit;
}
```

4. **Refactor**
```php
public function check_submission_limit(int $form_id, string $identifier): bool {
    if (!$this->settings->get('submission_limit_enabled', false)) {
        return false;
    }
    
    $count = $this->repository->count_by_identifier($form_id, $identifier);
    $limit = $this->settings->get('submission_limit', 10);
    
    return $count >= $limit;
}
```

## Debugging Tests

### Enable Debug Output
```bash
./vendor/bin/phpunit --debug
```

### Print Variables
```php
/** @test */
public function it_debugs_output() {
    $result = $this->repository->create(['title' => 'Test']);
    var_dump($result); // Print to console
    $this->assertTrue(true);
}
```

### Use `--testdox` for Readable Output
```bash
./vendor/bin/phpunit --testdox
```

Output:
```
FormsRepository
 ✔ It creates a form
 ✔ It finds form by id
 ✔ It updates form
 ✔ It deletes form
```
