<?php
declare(strict_types=1);

namespace SubtleForms\Engine;

/**
 * Validates field values with conditional logic support.
 */
final class FieldValidator
{
    /**
     * Validate submission payload against schema fields.
     * 
     * @param array<string,mixed> $schema
     * @param array<string,mixed> $payload
     * @param array<string,mixed> $conditionalState
     * @return array{valid: bool, errors: array<string,string>}
     */
    public function validate(array $schema, array $payload, array $conditionalState): array
    {
        $errors = [];
        $hiddenFields = $conditionalState['hidden_fields'] ?? [];
        $requiredFields = array_merge(
            $this->extractRequiredFields($schema['fields'] ?? []),
            $conditionalState['required_fields'] ?? []
        );

        // Remove conditionally hidden fields from required list
        $requiredFields = array_diff($requiredFields, $hiddenFields);

        // Validate required fields
        foreach ($requiredFields as $fieldKey) {
            $value = $payload[$fieldKey] ?? null;
            
            if ($this->isEmpty($value)) {
                $errors[$fieldKey] = sprintf('Field "%s" is required.', $fieldKey);
            }
        }

        // Type validation for submitted fields
        $fields = $this->flattenFields($schema['fields'] ?? []);
        foreach ($payload as $key => $value) {
            // Skip hidden fields
            if (in_array($key, $hiddenFields, true)) {
                continue;
            }

            $field = $fields[$key] ?? null;
            if (!$field) {
                continue;
            }

            $typeError = $this->validateFieldType($field, $value);
            if ($typeError) {
                $errors[$key] = $typeError;
            }
        }

        return [
            'valid' => empty($errors),
            'errors' => $errors,
        ];
    }

    /**
     * Extract required fields from schema.
     */
    private function extractRequiredFields(array $fields, array &$required = []): array
    {
        foreach ($fields as $field) {
            $config = $field['config'] ?? [];
            
            if (!empty($config['required'])) {
                $required[] = $field['key'];
            }

            // Process nested fields
            if (!empty($field['children']) && is_array($field['children'])) {
                $this->extractRequiredFields($field['children'], $required);
            }

            // Process columns
            if (!empty($field['columns']) && is_array($field['columns'])) {
                foreach ($field['columns'] as $column) {
                    if (is_array($column)) {
                        $this->extractRequiredFields($column, $required);
                    }
                }
            }
        }

        return $required;
    }

    /**
     * Flatten nested fields into key => field map.
     */
    private function flattenFields(array $fields, array &$map = []): array
    {
        foreach ($fields as $field) {
            if (!empty($field['key'])) {
                $map[$field['key']] = $field;
            }

            // Process nested fields
            if (!empty($field['children']) && is_array($field['children'])) {
                $this->flattenFields($field['children'], $map);
            }

            // Process columns
            if (!empty($field['columns']) && is_array($field['columns'])) {
                foreach ($field['columns'] as $column) {
                    if (is_array($column)) {
                        $this->flattenFields($column, $map);
                    }
                }
            }
        }

        return $map;
    }

    /**
     * Validate field value against field type.
     */
    private function validateFieldType(array $field, mixed $value): ?string
    {
        $type = $field['type'] ?? null;

        return match ($type) {
            'email' => $this->validateEmail($value),
            'url' => $this->validateUrl($value),
            'number' => $this->validateNumber($value),
            'phone' => $this->validatePhone($value),
            default => null,
        };
    }

    private function validateEmail(mixed $value): ?string
    {
        if ($this->isEmpty($value)) {
            return null;
        }

        if (!is_string($value) || !filter_var($value, FILTER_VALIDATE_EMAIL)) {
            return 'Invalid email address.';
        }

        return null;
    }

    private function validateUrl(mixed $value): ?string
    {
        if ($this->isEmpty($value)) {
            return null;
        }

        if (!is_string($value) || !filter_var($value, FILTER_VALIDATE_URL)) {
            return 'Invalid URL.';
        }

        return null;
    }

    private function validateNumber(mixed $value): ?string
    {
        if ($this->isEmpty($value)) {
            return null;
        }

        if (!is_numeric($value)) {
            return 'Must be a valid number.';
        }

        return null;
    }

    private function validatePhone(mixed $value): ?string
    {
        if ($this->isEmpty($value)) {
            return null;
        }

        if (!is_string($value) || !preg_match('/^[\d\s\-\+\(\)]+$/', $value)) {
            return 'Invalid phone number.';
        }

        return null;
    }

    private function isEmpty(mixed $value): bool
    {
        if (is_null($value)) {
            return true;
        }

        if (is_string($value) && trim($value) === '') {
            return true;
        }

        if (is_array($value) && empty($value)) {
            return true;
        }

        return false;
    }
}
