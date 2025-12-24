<?php
declare(strict_types=1);

namespace SubtleForms\Support;

class SchemaMigrator
{
    /**
     * Registered migrations.
     * Key is the target version. Value is the callable to transform schema to that version.
     * 
     * @var array<int, callable>
     */
    private array $migrations = [];

    public function __construct()
    {
        $this->registerMigrations();
    }

    private function registerMigrations(): void
    {
        // Future migrations will be registered here.
        // Example:
        // $this->migrations[2] = fn(array $schema) => $this->migrateToV2($schema);
    }

    /**
     * Migrate a schema to the latest version.
     * 
     * @param array $schema The schema to migrate
     * @return array The migrated schema
     */
    public function migrate(array $schema): array
    {
        $currentVersion = $schema['schema_version'] ?? 1;
        $latestVersion = $this->getLatestVersion();

        if ($currentVersion >= $latestVersion) {
            return $schema;
        }

        error_log(sprintf('SubtleForms: Migrating schema from version %d to %d', $currentVersion, $latestVersion));

        $migratedSchema = $schema;

        // Run migrations in order
        // We iterate from the next version up to the latest version
        for ($v = $currentVersion + 1; $v <= $latestVersion; $v++) {
            if (isset($this->migrations[$v])) {
                try {
                    $migratedSchema = call_user_func($this->migrations[$v], $migratedSchema);
                    // Ensure version is updated in the schema array
                    $migratedSchema['schema_version'] = $v;
                    error_log(sprintf('SubtleForms: Applied migration for version %d', $v));
                } catch (\Throwable $e) {
                    error_log(sprintf('SubtleForms: Migration to version %d failed: %s', $v, $e->getMessage()));
                    // Stop migration on failure to prevent corruption, return last successful state
                    break;
                }
            } else {
                // If a migration step is missing but we expect a higher version, 
                // we assume the version bump didn't require data transformation 
                // or we just bump the version number.
                $migratedSchema['schema_version'] = $v;
            }
        }

        return $migratedSchema;
    }

    /**
     * Get the latest known schema version.
     */
    public function getLatestVersion(): int
    {
        if (empty($this->migrations)) {
            return 1;
        }
        return max(array_keys($this->migrations));
    }
}
