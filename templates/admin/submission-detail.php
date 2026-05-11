<?php

if ( ! defined( 'ABSPATH' ) ) { exit; }
/**
 * Admin Submission detail mount point for React app
 */
// phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedVariableFound, WordPress.Security.NonceVerification.Recommended -- Template-scoped; URL params passed to React app, not processing form data.
$submissionId = isset($_GET['submission_id']) ? intval($_GET['submission_id']) : 0;
// phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedVariableFound, WordPress.Security.NonceVerification.Recommended -- Template-scoped; URL params passed to React app, not processing form data.
$formId = isset($_GET['form_id']) ? intval($_GET['form_id']) : 0;
?>
<div class="wrap subtleforms-admin subtleforms-admin-page">
    <div id="subtleforms-admin-app" data-page="submission-detail" data-submission-id="<?php echo esc_attr($submissionId); ?>" data-form-id="<?php echo esc_attr($formId); ?>"></div>
</div>
