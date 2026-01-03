<?php
/**
 * SubtleForms Form Block
 * 
 * Gutenberg block for embedding published forms.
 */

namespace SubtleForms\Blocks;

class SubtleFormsFormBlock {
    
    /**
     * Static flag to prevent duplicate registration
     */
    private static $registered = false;
    
    /**
     * Register the block type
     */
    public function register_block() {
        // Prevent duplicate registration
        if (self::$registered) {
            return;
        }
        
        // Check if block is already registered in WordPress
        if (\WP_Block_Type_Registry::get_instance()->is_registered('subtleforms/form')) {
            self::$registered = true;
            return;
        }
        
        register_block_type(
            SUBTLEFORMS_PLUGIN_DIR . 'build/blocks/subtleforms-form',
            [
                'render_callback' => [$this, 'render_block'],
            ]
        );
        
        self::$registered = true;
    }
    
    /**
     * Render block on frontend
     * 
     * @param array $attributes Block attributes
     * @param string $content Block content
     * @return string Rendered HTML
     */
    public function render_block($attributes, $content) {
        $form_id = isset($attributes['formId']) ? absint($attributes['formId']) : 0;
        
        if (!$form_id) {
            // Editor will handle empty state, frontend shows nothing
            return '';
        }
        
        // Enqueue frontend assets
        $this->enqueue_frontend_assets();
        
        // Output container that frontend JS will mount into
        return sprintf(
            '<div class="wp-block-subtleforms-form" data-form-id="%d"></div>',
            esc_attr($form_id)
        );
    }
    
    /**
     * Enqueue frontend assets
     */
    private function enqueue_frontend_assets() {
        // Only enqueue once even if multiple blocks on page
        static $enqueued = false;
        
        if ($enqueued) {
            return;
        }
        
        $asset_file = include SUBTLEFORMS_PLUGIN_DIR . 'build/frontend/frontend.asset.php';
        
        wp_enqueue_script(
            'subtleforms-frontend',
            SUBTLEFORMS_PLUGIN_URL . 'build/frontend/frontend.js',
            $asset_file['dependencies'],
            $asset_file['version'],
            true
        );
        
        wp_enqueue_style(
            'subtleforms-frontend',
            SUBTLEFORMS_PLUGIN_URL . 'build/frontend/index.jsx.css',
            [],
            $asset_file['version']
        );
        
        // Pass REST API config to frontend
        wp_localize_script(
            'subtleforms-frontend',
            'subtleformsFrontend',
            array(
                'restUrl' => rest_url('subtleforms/v1/'),
                'nonce' => wp_create_nonce('wp_rest'),
            )
        );
        
        $enqueued = true;
    }
}
