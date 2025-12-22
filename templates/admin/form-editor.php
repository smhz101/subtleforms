<?php
/**
 * Admin Form Editor mount point for React app
 */
$form = $data['form'] ?? null;

add_filter('admin_body_class', function ($classes) {
    if (strpos($classes, 'subtleforms-builder-page') === false) {
        $classes .= ' subtleforms-builder-page';
    }

    return trim($classes);
});
?>
<div class="wrap subtleforms-admin">
    <div id="subtleforms-admin-app" data-page="form-editor" data-form-id="<?php echo esc_attr($form['id'] ?? 0); ?>"></div>
</div>
