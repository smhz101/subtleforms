<?php
/**
 * Admin Submission detail mount point for React app
 */
$submissionId = isset($_GET['submission_id']) ? intval($_GET['submission_id']) : 0;
$formId = isset($_GET['form_id']) ? intval($_GET['form_id']) : 0;
?>
<div class="wrap subtleforms-admin subtleforms-admin-page">
    <div id="subtleforms-admin-app" data-page="submission-detail" data-submission-id="<?php echo esc_attr($submissionId); ?>" data-form-id="<?php echo esc_attr($formId); ?>"></div>
</div>
