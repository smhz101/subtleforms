<?php
/**
 * Admin Submissions list mount point for React app
 */
$formId = isset($_GET['form_id']) ? intval($_GET['form_id']) : 0;
?>
<div class="wrap subtleforms-admin">
    <div id="subtleforms-admin-app" data-page="submissions-list" data-form-id="<?php echo esc_attr($formId); ?>"></div>
</div>
