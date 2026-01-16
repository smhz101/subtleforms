# Schema Versioning

## Core concept

SubtleForms uses **immutable schema versioning** for published forms. Draft forms remain mutable, but once published, the schema is frozen in the `schema_versions` table.

## Why immutable schemas?

- **Submission integrity:** Old submissions remain valid against their original schema
- **Migration safety:** Schema changes don't break existing data
- **Audit trail:** Track what schema was active when each submission was received
- **Rollback capability:** Can restore previous schema versions if needed

## Database tables

### Forms table (`subtleforms_forms`)

```sql
CREATE TABLE subtleforms_forms (
  id bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  title varchar(255) NOT NULL,
  status varchar(20) DEFAULT 'draft',
  draft_schema longtext,           -- Mutable schema (draft forms)
  active_schema_id bigint(20),     -- Points to schema_versions.id (published forms)
  settings longtext,
  created_at datetime,
  updated_at datetime,
  PRIMARY KEY (id)
);
```

### Schema Versions table (`subtleforms_schema_versions`)

```sql
CREATE TABLE subtleforms_schema_versions (
  id bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  form_id bigint(20) UNSIGNED NOT NULL,
  schema longtext NOT NULL,        -- Immutable schema JSON
  version int(11) NOT NULL,         -- Incremental version number
  created_at datetime,
  PRIMARY KEY (id),
  KEY form_id (form_id)
);
```

### Submissions table (`subtleforms_submissions`)

```sql
CREATE TABLE subtleforms_submissions (
  id bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  form_id bigint(20) UNSIGNED NOT NULL,
  schema_version_id bigint(20),    -- Links to schema_versions.id
  field_data longtext NOT NULL,
  user_identifier varchar(255),
  ip_address varchar(45),
  created_at datetime,
  PRIMARY KEY (id),
  KEY form_id (form_id),
  KEY schema_version_id (schema_version_id)
);
```

## Workflow

### Draft form (mutable schema)

```php
// Create draft form
$form = $forms_repository->create([
    'title' => 'Contact Form',
    'draft_schema' => json_encode([
        'fields' => [
            ['id' => 'field_1', 'type' => 'text', 'label' => 'Name']
        ]
    ]),
    'settings' => json_encode([]),
    'status' => 'draft'
]);

// Update draft schema (allowed)
$forms_repository->update($form['id'], [
    'draft_schema' => json_encode([
        'fields' => [
            ['id' => 'field_1', 'type' => 'text', 'label' => 'Full Name'], // Changed
            ['id' => 'field_2', 'type' => 'email', 'label' => 'Email']     // Added
        ]
    ])
]);
```

### Publishing form (creates immutable schema)

```php
// Publish form
$schema_version_id = $forms_repository->createSchemaVersion(
    $form['id'],
    json_decode($form['draft_schema'], true)
);

$forms_repository->update($form['id'], [
    'status' => 'published',
    'active_schema_id' => $schema_version_id
]);
```

**What happens:**
1. Schema copied from `draft_schema` to `schema_versions` table
2. `active_schema_id` points to new schema version
3. Form status changes to 'published'
4. Future schema changes require new version

### Updating published form schema

**❌ Wrong (modifying active schema):**

```php
// This would break existing submissions!
$forms_repository->update($form['id'], [
    'draft_schema' => json_encode($new_schema) // Don't do this directly
]);
```

**✅ Correct (create new version):**

```php
// 1. Update draft_schema
$forms_repository->update($form['id'], [
    'draft_schema' => json_encode($new_schema)
]);

// 2. Create new schema version
$new_version_id = $forms_repository->createSchemaVersion(
    $form['id'],
    $new_schema
);

// 3. Activate new version
$forms_repository->update($form['id'], [
    'active_schema_id' => $new_version_id
]);
```

## Loading schemas

### For builder (editing)

```php
// Load draft schema (mutable)
$form = $forms_repository->find($form_id);
$schema = json_decode($form['draft_schema'], true);
```

### For frontend (rendering)

```php
// Load active schema (immutable)
$schema = $forms_repository->loadSchemaVersion($form_id);

// Returns schema from schema_versions table
// Or draft_schema if form is still draft
```

### For submission processing

```php
// Get active schema
$schema = $forms_repository->loadSchemaVersion($form_id);

// Store schema version with submission
$submission_id = $submissions_repository->create([
    'form_id' => $form_id,
    'schema_version_id' => $schema['schema_version_id'] ?? null,
    'field_data' => json_encode($validated_data),
    'user_identifier' => get_current_user_id() ?: $ip_address,
    'ip_address' => $ip_address,
    'created_at' => current_time('mysql')
]);
```

## Schema version history

```php
// Get all versions for a form
function getSchemaVersions(int $form_id): array {
    global $wpdb;
    
    $table = $wpdb->prefix . 'subtleforms_schema_versions';
    
    $query = $wpdb->prepare(
        "SELECT * FROM {$table} WHERE form_id = %d ORDER BY version DESC",
        $form_id
    );
    
    return $wpdb->get_results($query, ARRAY_A);
}
```

## Migration scenarios

### Adding a field (non-breaking)

**Old schema:**
```json
{
  "fields": [
    {"id": "field_1", "type": "text", "label": "Name"}
  ]
}
```

**New schema:**
```json
{
  "fields": [
    {"id": "field_1", "type": "text", "label": "Name"},
    {"id": "field_2", "type": "email", "label": "Email"}
  ]
}
```

**Impact:** Old submissions remain valid (missing `field_2` is acceptable)

### Removing a field (breaking)

**Old schema:**
```json
{
  "fields": [
    {"id": "field_1", "type": "text", "label": "Name"},
    {"id": "field_2", "type": "phone", "label": "Phone"}
  ]
}
```

**New schema:**
```json
{
  "fields": [
    {"id": "field_1", "type": "text", "label": "Name"}
  ]
}
```

**Impact:** Old submissions have `field_2` data that no longer maps to schema. Consider:
1. Keep field hidden but present in schema
2. Export old data before migration
3. Add migration script to clean up old submissions

### Changing field type (breaking)

**Old schema:**
```json
{"id": "field_1", "type": "text", "label": "Age"}
```

**New schema:**
```json
{"id": "field_1", "type": "number", "label": "Age"}
```

**Impact:** Old text values may not be valid numbers. Requires data migration.

## Rollback

```php
// Rollback to previous version
function rollbackToVersion(int $form_id, int $version_id) {
    global $forms_repository;
    
    // Verify version exists
    $version = getSchemaVersion($version_id);
    if (!$version || $version['form_id'] !== $form_id) {
        throw new Exception('Invalid version');
    }
    
    // Set as active
    $forms_repository->update($form_id, [
        'active_schema_id' => $version_id,
        'draft_schema' => $version['schema'] // Sync draft with active
    ]);
}
```

## Common pitfalls

❌ **Modifying draft_schema of published form without creating version:**
```php
$forms_repository->update($form_id, [
    'draft_schema' => json_encode($new_schema)
]);
// Active schema still points to old version!
```

✅ **Create new version and activate:**
```php
$version_id = $forms_repository->createSchemaVersion($form_id, $new_schema);
$forms_repository->update($form_id, [
    'draft_schema' => json_encode($new_schema),
    'active_schema_id' => $version_id
]);
```

❌ **Loading wrong schema for submission processing:**
```php
$form = $forms_repository->find($form_id);
$schema = json_decode($form['draft_schema'], true); // Wrong!
```

✅ **Load active schema:**
```php
$schema = $forms_repository->loadSchemaVersion($form_id);
```

❌ **Not storing schema_version_id with submission:**
```php
$submissions_repository->create([
    'form_id' => $form_id,
    'field_data' => json_encode($data)
    // Missing schema_version_id!
]);
```

✅ **Always link to schema version:**
```php
$submissions_repository->create([
    'form_id' => $form_id,
    'schema_version_id' => $schema['schema_version_id'],
    'field_data' => json_encode($data)
]);
```

## Testing schema versioning

```php
public function test_publishing_creates_schema_version() {
    $form = $this->forms_repository->create([
        'title' => 'Test',
        'draft_schema' => json_encode(['fields' => []]),
        'settings' => '{}',
        'status' => 'draft'
    ]);
    
    $version_id = $this->forms_repository->createSchemaVersion(
        $form['id'],
        ['fields' => []]
    );
    
    $this->assertGreaterThan(0, $version_id);
    
    $schema = $this->forms_repository->loadSchemaVersion($form['id']);
    $this->assertEquals($version_id, $schema['schema_version_id']);
}

public function test_active_schema_is_immutable() {
    // Create and publish form
    $form = $this->createPublishedForm();
    
    // Load active schema
    $schema1 = $this->forms_repository->loadSchemaVersion($form['id']);
    
    // Modify draft_schema
    $this->forms_repository->update($form['id'], [
        'draft_schema' => json_encode(['fields' => ['new_field']])
    ]);
    
    // Active schema should be unchanged
    $schema2 = $this->forms_repository->loadSchemaVersion($form['id']);
    $this->assertEquals($schema1, $schema2);
}
```
