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
     * @param array $field
     * @param mixed $value
     * @return string|null
     */
    private function validateFieldType($field, $value)
    {
        $type = isset($field['type']) ? $field['type'] : null;

        switch ($type) {
            case 'email':
                return $this->validateEmail($value);
            case 'url':
                return $this->validateUrl($value);
            case 'number':
                return $this->validateNumber($value);
            case 'phone':
                return $this->validatePhone($value);
            case 'payment_amount':
                return $this->validatePaymentAmount($value, $field);
            case 'payment_coupon':
                return $this->validatePaymentCoupon($value, $field);
            default:
                return null;
        }
    }

    /**
     * @param mixed $value
     * @return string|null
     */
    private function validateEmail($value)
    {
        if ($this->isEmpty($value)) {
            return null;
        }

        if (!is_string($value) || !filter_var($value, FILTER_VALIDATE_EMAIL)) {
            return 'Invalid email address.';
        }

        return null;
    }

    /**
     * @param mixed $value
     * @return string|null
     */
    private function validateUrl($value)
    {
        if ($this->isEmpty($value)) {
            return null;
        }

        if (!is_string($value) || !filter_var($value, FILTER_VALIDATE_URL)) {
            return 'Invalid URL.';
        }

        return null;
    }

    /**
     * @param mixed $value
     * @return string|null
     */
    private function validateNumber($value)
    {
        if ($this->isEmpty($value)) {
            return null;
        }

        if (!is_numeric($value)) {
            return 'Must be a valid number.';
        }

        return null;
    }

    /**
     * @param mixed $value
     * @return string|null
     */
    private function validatePhone($value)
    {
        if ($this->isEmpty($value)) {
            return null;
        }

        if (!is_string($value) || !preg_match('/^[\d\s\-\+\(\)]+$/', $value)) {
            return 'Invalid phone number.';
        }

        return null;
    }

    /**
     * @param mixed $value
     * @return bool
     */
    private function isEmpty($value)
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

    /**
     * Validate payment amount field.
     * 
     * @param mixed $value
     * @param array $field
     * @return string|null
     */
    private function validatePaymentAmount($value, $field)
    {
        if ($this->isEmpty($value)) {
            return null;
        }

        if (!is_numeric($value)) {
            return 'Payment amount must be a valid number.';
        }

        $amount = floatval($value);
        $config = $field['config'] ?? [];
        
        // Must be positive
        if ($amount < 0) {
            return 'Payment amount must be positive.';
        }

        // Check minimum
        $min = isset($config['min']) ? floatval($config['min']) : 0;
        if ($amount < $min) {
            return sprintf('Payment amount must be at least %s.', number_format($min, 2));
        }

        // Check maximum
        if (isset($config['max'])) {
            $max = floatval($config['max']);
            if ($amount > $max) {
                return sprintf('Payment amount cannot exceed %s.', number_format($max, 2));
            }
        }

        return null;
    }

    /**
     * Validate payment coupon field.
     * 
     * @param mixed $value
     * @param array $field
     * @return string|null
     */
    private function validatePaymentCoupon($value, $field)
    {
        if ($this->isEmpty($value)) {
            return null;
        }

        if (!is_string($value)) {
            return 'Coupon code must be a string.';
        }

        $config = $field['config'] ?? [];
        $maxLength = isset($config['maxLength']) ? intval($config['maxLength']) : 50;

        if (strlen($value) > $maxLength) {
            return sprintf('Coupon code cannot exceed %d characters.', $maxLength);
        }

        // Basic sanitization check - alphanumeric and common special chars only
        if (!preg_match('/^[a-zA-Z0-9\-_]+$/', $value)) {
            return 'Coupon code contains invalid characters.';
        }

        return null;
    }
