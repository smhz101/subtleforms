<?php
/**
 * Admin Submissions list/detail mount point for React app
 */
$formId = isset($_GET['form_id']) ? intval($_GET['form_id']) : 0;
$submissionId = isset($_GET['submission_id']) ? intval($_GET['submission_id']) : 0;
$page = $submissionId ? 'submission-detail' : 'submissions-list';
?>
<div class="wrap subtleforms-admin subtleforms-admin-page">
    <div id="subtleforms-admin-app" data-page="<?php echo esc_attr($page); ?>" data-form-id="<?php echo esc_attr($formId); ?>" data-submission-id="<?php echo esc_attr($submissionId); ?>"></div>
</div>
