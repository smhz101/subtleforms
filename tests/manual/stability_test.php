<?php
// phpcs:disable -- Dev/test script; not shipped in production plugin.
/**
 * Stability Test Script for SubtleForms v1.1.34
 */

use SubtleForms\Plugin;
use SubtleForms\Repositories\FormsRepository;
use SubtleForms\Repositories\SubmissionsRepository;
use SubtleForms\Frontend\Shortcode;

// Ensure we're in WP context
if (!defined('ABSPATH')) {
    die('Must be run within WordPress context');
}

echo "Starting Stability Test...\n";

try {
    $plugin = Plugin::instance();
    $container = $plugin->container();
    
    $formsRepo = $container->get(FormsRepository::class);
    $subsRepo = $container->get(SubmissionsRepository::class);
    
    // 1. Create Form
    echo "[1/6] Creating Form... ";
    $formId = $formsRepo->create([
        'title' => 'Stability Test Form ' . date('Y-m-d H:i:s'),
        'description' => 'Automated test form',
        'status' => 'draft'
    ]);
    
    if (!$formId) throw new Exception("Failed to create form");
    echo "OK (ID: $formId)\n";
    
    // 2. Save Schema (All Core Fields)
    echo "[2/6] Saving Schema... ";
    $schema = [
        'metadata' => [
            'title' => 'Stability Test Form',
            'name' => 'stability_test_form',
            'description' => 'Automated test form'
        ],
        'fields' => [
            ['key' => 'f1', 'type' => 'text', 'name' => 'full_name', 'label' => 'Full Name', 'required' => true],
            ['key' => 'f2', 'type' => 'email', 'name' => 'email', 'label' => 'Email Address', 'required' => true],
            ['key' => 'f3', 'type' => 'textarea', 'name' => 'message', 'label' => 'Message'],
            ['key' => 'f4', 'type' => 'select', 'name' => 'topic', 'label' => 'Topic', 'options' => [
                ['label' => 'Support', 'value' => 'support'],
                ['label' => 'Sales', 'value' => 'sales']
            ]],
            ['key' => 'f5', 'type' => 'checkbox', 'name' => 'terms', 'label' => 'Agree to Terms'],
            ['key' => 'f6', 'type' => 'radio', 'name' => 'preference', 'label' => 'Contact Preference', 'options' => [
                ['label' => 'Email', 'value' => 'email'],
                ['label' => 'Phone', 'value' => 'phone']
            ]],
            ['key' => 'f7', 'type' => 'url', 'name' => 'website', 'label' => 'Website'],
            ['key' => 'f8', 'type' => 'number', 'name' => 'age', 'label' => 'Age']
        ],
        'actions' => []
    ];
    
    $version = $formsRepo->saveSchemaVersion($formId, $schema, true);
    if (!$version) throw new Exception("Failed to save schema");
    echo "OK (Version: {$version})\n";
    
    // 3. Publish Form
    echo "[3/6] Publishing Form... ";
    $formsRepo->update($formId, ['status' => 'published']); // Using 'published' as per Shortcode check
    $form = $formsRepo->find($formId);
    if ($form['status'] !== 'published') throw new Exception("Failed to publish form (Status: {$form['status']})");
    echo "OK\n";
    
    // 4. Test Shortcode
    echo "[4/6] Testing Shortcode... ";
    $shortcodeOutput = do_shortcode("[subtleforms id=\"$formId\"]");
    if (strpos($shortcodeOutput, 'subtleforms-form-container') === false) {
        throw new Exception("Shortcode failed to render container. Output: " . substr($shortcodeOutput, 0, 100));
    }
    if (strpos($shortcodeOutput, "data-form-id=\"$formId\"") === false) {
        throw new Exception("Shortcode missing correct form ID");
    }
    echo "OK\n";
    
    // 5. Create Submission
    echo "[5/6] Creating Submission... ";
    $payload = [
        'full_name' => 'Test User',
        'email' => 'test@example.com',
        'message' => 'This is a test message with special chars: & < > " \'',
        'topic' => 'support',
        'terms' => true,
        'preference' => 'email',
        'website' => 'https://example.com',
        'age' => 42
    ];
    
    $subId = $subsRepo->create([
        'form_id' => $formId,
        'schema_version' => $version,
        'payload' => $payload,
        'meta' => ['source' => 'stability_test'],
        'ip_address' => '127.0.0.1',
        'user_agent' => 'StabilityTest/1.0'
    ]);
    
    if (!$subId) throw new Exception("Failed to create submission");
    echo "OK (ID: $subId)\n";
    
    // 6. Retrieve & Verify Submission
    echo "[6/6] Verifying Submission Data... ";
    $submission = $subsRepo->find($subId);
    
    if ($submission['payload']['full_name'] !== 'Test User') throw new Exception("Data mismatch: full_name");
    if ($submission['payload']['terms'] !== true) throw new Exception("Data mismatch: terms (boolean)");
    if ($submission['payload']['age'] !== 42) throw new Exception("Data mismatch: age (number)");
    
    echo "OK\n";
    
    echo "\n✅ STABILITY TEST PASSED SUCCESSFULLY\n";
    
} catch (Exception $e) {
    echo "\n❌ TEST FAILED: " . $e->getMessage() . "\n";
    echo "Trace:\n" . $e->getTraceAsString() . "\n";
    exit(1);
} catch (Error $e) {
    echo "\n❌ FATAL ERROR: " . $e->getMessage() . "\n";
    echo "Trace:\n" . $e->getTraceAsString() . "\n";
    exit(1);
}
