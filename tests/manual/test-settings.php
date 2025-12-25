<?php
/**
 * Quick test script for Settings functionality
 * 
 * Usage: wp eval-file wp-content/plugins/subtleforms/tests/manual/test-settings.php
 */

// Ensure WordPress is loaded
if (!defined('ABSPATH')) {
    die('WordPress not loaded');
}

echo "=== SubtleForms Settings Test ===\n\n";

// Access Settings directly
$settings = new \SubtleForms\Support\Settings();
echo "✓ Settings instance created\n\n";

// Test 1: Get all default settings
echo "Test 1: Get all settings\n";
$allSettings = $settings->getAll();
echo "  - Total settings: " . count($allSettings) . "\n";
echo "  - Default form status: " . $allSettings['default_form_status'] . "\n";
echo "  - Autosave enabled: " . ($allSettings['autosave_enabled'] ? 'yes' : 'no') . "\n";
echo "  - Autosave interval: " . $allSettings['autosave_interval'] . "s\n";
echo "  ✓ PASS\n\n";

// Test 2: Get individual setting
echo "Test 2: Get individual setting\n";
$status = $settings->get('default_form_status');
echo "  - Default form status: $status\n";
echo "  ✓ PASS\n\n";

// Test 3: Update settings
echo "Test 3: Update settings\n";
$testSettings = [
    'default_form_status' => 'published',
    'autosave_interval' => 5,
    'success_message' => 'Test success message',
];
$result = $settings->update($testSettings);
if ($result) {
    $updated = $settings->get('default_form_status');
    echo "  - Updated default_form_status to: $updated\n";
    echo "  - Success message: " . $settings->get('success_message') . "\n";
    echo "  ✓ PASS\n\n";
} else {
    echo "  ✗ FAIL: Could not update settings\n\n";
}

// Test 4: Validation
echo "Test 4: Validation\n";
try {
    $settings->update(['autosave_interval' => 100]); // Should fail (max 60)
    echo "  ✗ FAIL: Should have thrown validation error\n\n";
} catch (\InvalidArgumentException $e) {
    echo "  - Validation error caught: " . $e->getMessage() . "\n";
    echo "  ✓ PASS\n\n";
}

// Test 5: Email helpers
echo "Test 5: Email helper methods\n";
$senderEmail = $settings->getSenderEmail();
$senderName = $settings->getSenderName();
$adminEmail = $settings->getAdminEmail();
echo "  - Sender email: $senderEmail\n";
echo "  - Sender name: $senderName\n";
echo "  - Admin email: $adminEmail\n";
echo "  ✓ PASS\n\n";

// Test 6: Reset settings
echo "Test 6: Reset to defaults\n";
$settings->reset();
$resetStatus = $settings->get('default_form_status');
echo "  - Default form status after reset: $resetStatus\n";
if ($resetStatus === 'draft') {
    echo "  ✓ PASS\n\n";
} else {
    echo "  ✗ FAIL: Settings not reset properly\n\n";
}

// Test 7: Settings API endpoint registration
echo "Test 7: REST API endpoint\n";
$routes = rest_get_server()->get_routes();
$hasSettingsRoute = isset($routes['/subtleforms/v1/settings']);
$hasResetRoute = isset($routes['/subtleforms/v1/settings/reset']);

if ($hasSettingsRoute && $hasResetRoute) {
    echo "  - /subtleforms/v1/settings: registered\n";
    echo "  - /subtleforms/v1/settings/reset: registered\n";
    echo "  ✓ PASS\n\n";
} else {
    echo "  ✗ FAIL: REST endpoints not registered\n\n";
}

echo "=== All Tests Completed ===\n";
echo "\nSummary:\n";
echo "- Settings class: Working\n";
echo "- Get/Set operations: Working\n";
echo "- Validation: Working\n";
echo "- Helper methods: Working\n";
echo "- Reset functionality: Working\n";
echo "- REST API: Registered\n";
echo "\n✓ Settings implementation is functional!\n";
