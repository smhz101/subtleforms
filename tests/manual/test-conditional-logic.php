<?php
// phpcs:disable -- Dev/test script; not shipped in production plugin.
if ( ! defined( 'ABSPATH' ) ) { exit; }
/**
 * Manual test script for conditional logic.
 * Run: wp eval-file test-conditional-logic.php
 */

require_once __DIR__ . '/src/Engine/ConditionalLogic.php';
require_once __DIR__ . '/src/Engine/FieldValidator.php';

use SubtleForms\Engine\ConditionalLogic;
use SubtleForms\Engine\FieldValidator;

echo "=== Conditional Logic Test Suite ===\n\n";

$logic = new ConditionalLogic();
$validator = new FieldValidator();

// Test 1: Hidden field skips validation
echo "Test 1: Hidden field skips validation\n";
$schema = [
    'fields' => [
        [
            'type' => 'email',
            'key' => 'email',
            'config' => [
                'label' => 'Email',
                'required' => true,
                'conditions' => [
                    ['sourceField' => 'has_email', 'operator' => 'equals', 'value' => 'yes', 'effect' => 'show']
                ]
            ]
        ]
    ]
];
$payload = ['has_email' => 'no'];
$state = $logic->evaluate($schema, $payload);
echo "Hidden fields: " . implode(', ', $state['hidden_fields']) . "\n";
$result = $validator->validate($schema, $payload, $state);
echo "Valid: " . ($result['valid'] ? 'YES' : 'NO') . "\n";
echo "Expected: YES (email is hidden, no validation)\n\n";

// Test 2: Conditional requirement
echo "Test 2: Conditional requirement\n";
$schema = [
    'fields' => [
        [
            'type' => 'text',
            'key' => 'company',
            'config' => [
                'label' => 'Company',
                'conditions' => [
                    ['sourceField' => 'employed', 'operator' => 'equals', 'value' => 'yes', 'effect' => 'require']
                ]
            ]
        ]
    ]
];
$payload = ['employed' => 'yes'];
$state = $logic->evaluate($schema, $payload);
echo "Required fields: " . implode(', ', $state['required_fields']) . "\n";
$result = $validator->validate($schema, $payload, $state);
echo "Valid: " . ($result['valid'] ? 'YES' : 'NO') . "\n";
echo "Errors: " . implode(', ', $result['errors']) . "\n";
echo "Expected: NO (company is required but missing)\n\n";

// Test 3: Greater than operator
echo "Test 3: Greater than operator\n";
$schema = [
    'fields' => [
        [
            'type' => 'text',
            'key' => 'adult_consent',
            'config' => [
                'label' => 'Adult Consent',
                'conditions' => [
                    ['sourceField' => 'age', 'operator' => 'greater_than', 'value' => '18', 'effect' => 'show']
                ]
            ]
        ]
    ]
];
$payload = ['age' => '25'];
$state = $logic->evaluate($schema, $payload);
echo "Hidden fields: " . (empty($state['hidden_fields']) ? 'NONE' : implode(', ', $state['hidden_fields'])) . "\n";
echo "Expected: NONE (age > 18, field shown)\n\n";

// Test 4: Empty operator
echo "Test 4: Empty operator\n";
$schema = [
    'fields' => [
        [
            'type' => 'text',
            'key' => 'reason_other',
            'config' => [
                'label' => 'Other Reason',
                'conditions' => [
                    ['sourceField' => 'reason', 'operator' => 'empty', 'value' => null, 'effect' => 'hide']
                ]
            ]
        ]
    ]
];
$payload = ['reason' => ''];
$state = $logic->evaluate($schema, $payload);
echo "Hidden fields: " . implode(', ', $state['hidden_fields']) . "\n";
echo "Expected: reason_other (reason is empty, hide other field)\n\n";

// Test 5: Step hiding
echo "Test 5: Step hiding\n";
$schema = [
    'fields' => [
        [
            'type' => 'step',
            'key' => 'payment_step',
            'config' => [
                'title' => 'Payment',
                'conditions' => [
                    ['sourceField' => 'plan', 'operator' => 'equals', 'value' => 'free', 'effect' => 'hide']
                ]
            ],
            'children' => []
        ]
    ]
];
$payload = ['plan' => 'free'];
$state = $logic->evaluate($schema, $payload);
echo "Hidden steps: " . implode(', ', $state['hidden_steps']) . "\n";
echo "Expected: payment_step (free plan hides payment)\n\n";

// Test 6: Contains operator
echo "Test 6: Contains operator\n";
$schema = [
    'fields' => [
        [
            'type' => 'text',
            'key' => 'tech_details',
            'config' => [
                'label' => 'Tech Details',
                'conditions' => [
                    ['sourceField' => 'interests', 'operator' => 'contains', 'value' => 'technology', 'effect' => 'show']
                ]
            ]
        ]
    ]
];
$payload = ['interests' => ['sports', 'technology', 'music']];
$state = $logic->evaluate($schema, $payload);
echo "Hidden fields: " . (empty($state['hidden_fields']) ? 'NONE' : implode(', ', $state['hidden_fields'])) . "\n";
echo "Expected: NONE (interests contains technology, field shown)\n\n";

echo "=== All Tests Complete ===\n";
