<?php
/**
 * Admin Forms list mount point for React app
 */
$formId = isset($_GET['form_id']) ? intval($_GET['form_id']) : 0;
?>
<div class="wrap subtleforms-admin">
    <h1><?php _e('Subtle Forms', 'subtleforms'); ?></h1>
    <div id="subtleforms-admin-app" data-page="forms-list" data-form-id="<?php echo esc_attr($formId); ?>"></div>
</div>
