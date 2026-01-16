# Repository Pattern

## Core principle

All database access in SubtleForms MUST go through repository classes. Never use `$wpdb` directly in controllers or business logic.

## Repository structure

```
src/Repositories/
├── FormsRepository.php
├── SubmissionsRepository.php
└── SchemaVersionsRepository.php (implicit via FormsRepository)
```

## Forms Repository

**Location:** `src/Repositories/FormsRepository.php`

### Key methods

```php
// List forms with pagination and filtering
public function all(array $args = []): array

// Get single form by ID
public function find(int $id): ?array

// Create new form
public function create(array $data): array

// Update existing form
public function update(int $id, array $data): bool

// Delete form
public function delete(int $id): bool

// Get active schema for published form
public function loadSchemaVersion(int $form_id): ?array

// Create immutable schema version (on publish)
public function createSchemaVersion(int $form_id, array $schema): int

// Get submission counts per form (bulk query)
public function get_counts(array $filters = []): array
```

### Usage example

```php
// In RestController.php
public function get_forms(WP_REST_Request $request) {
    $forms = $this->forms_repository->all([
        'status' => 'published',
        'per_page' => 20,
        'page' => 1
    ]);
    
    return rest_ensure_response($forms);
}
```

## Submissions Repository

**Location:** `src/Repositories/SubmissionsRepository.php`

### Key methods

```php
// List submissions for a form
public function all(int $form_id, array $args = []): array

// Get single submission
public function find(int $id): ?array

// Create submission
public function create(array $data): int

// Delete submission
public function delete(int $id): bool

// Bulk submission counts (eliminates N+1)
public function get_counts_by_forms(array $form_ids, $status = null): array

// Count by user/IP for rate limiting
public function count_by_identifier(int $form_id, string $identifier): int
```

### Bulk query pattern

**❌ Wrong (N+1 problem):**

```php
$forms = $this->forms_repository->all();
foreach ($forms as &$form) {
    $form['submission_count'] = $this->submissions_repository->count($form['id']);
}
```

**✅ Correct (single query):**

```php
$forms = $this->forms_repository->all();
$form_ids = array_column($forms, 'id');
$counts = $this->submissions_repository->get_counts_by_forms($form_ids);

foreach ($forms as &$form) {
    $form['submission_count'] = $counts[$form['id']] ?? 0;
}
```

## Adding new repository methods

1. **Method signature must be type-safe:**
```php
public function methodName(int $id, array $data): ?array
```

2. **Always use prepared statements:**
```php
$query = $wpdb->prepare(
    "SELECT * FROM {$wpdb->prefix}subtleforms_forms WHERE id = %d",
    $id
);
```

3. **Return consistent data types:**
   - Single record: `?array` (null if not found)
   - Multiple records: `array` (empty array if none)
   - Write operations: `bool` (success/failure) or `int` (new ID)

4. **Use placeholders correctly:**
   - `%d` for integers
   - `%s` for strings
   - `%f` for floats

## SQL safety checklist

- ✅ Use `$wpdb->prepare()` with placeholders
- ✅ Validate input types before queries
- ✅ Use `absint()` for IDs
- ✅ Escape table names with `{$wpdb->prefix}`
- ❌ Never interpolate user input into SQL
- ❌ Never use string concatenation for queries
- ❌ Never use `$wpdb->query()` without `prepare()`

## Transactions (when needed)

```php
$wpdb->query('START TRANSACTION');

try {
    $form_id = $this->forms_repository->create($form_data);
    $this->forms_repository->createSchemaVersion($form_id, $schema);
    
    $wpdb->query('COMMIT');
} catch (Exception $e) {
    $wpdb->query('ROLLBACK');
    throw $e;
}
```

## Common pitfalls

❌ **Using `$wpdb` directly in controller:**
```php
// In RestController.php
global $wpdb;
$results = $wpdb->get_results("SELECT * FROM {$wpdb->prefix}subtleforms_forms");
```

✅ **Using repository:**
```php
// In RestController.php
$results = $this->forms_repository->all();
```

❌ **Looping to get related data:**
```php
foreach ($forms as &$form) {
    $form['count'] = $this->submissions_repository->count($form['id']);
}
```

✅ **Using bulk query:**
```php
$counts = $this->submissions_repository->get_counts_by_forms($form_ids);
```

## Testing repositories

```php
// In tests/Integration/Repositories/FormsRepositoryTest.php
public function test_it_creates_a_form() {
    $form = $this->repository->create([
        'title' => 'Test Form',
        'schema' => '{}',
        'settings' => '{}'
    ]);
    
    $this->assertIsArray($form);
    $this->assertEquals('Test Form', $form['title']);
}
```

## Dependency injection

Repositories are injected via constructor:

```php
class RestController {
    private FormsRepository $forms_repository;
    private SubmissionsRepository $submissions_repository;
    
    public function __construct(
        FormsRepository $forms_repository,
        SubmissionsRepository $submissions_repository
    ) {
        $this->forms_repository = $forms_repository;
        $this->submissions_repository = $submissions_repository;
    }
}
```

Instantiated in plugin bootstrap:

```php
// In subtleforms.php
$forms_repo = new FormsRepository($wpdb);
$submissions_repo = new SubmissionsRepository($wpdb);
$controller = new RestController($forms_repo, $submissions_repo);
```
