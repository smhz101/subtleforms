<?php
declare(strict_types=1);

namespace SubtleForms\Frontend;

use SubtleForms\Repositories\FormsRepository;
use SubtleForms\Support\Settings;

/**
 * Frontend shortcode handler.
 */
final class Shortcode
{
    private $formsRepo;
    private $settings;

    public function __construct(FormsRepository $formsRepo, Settings $settings = null)
    {
        $this->formsRepo = $formsRepo;
        $this->settings = $settings;
    }

    /**
     * Register [subtleforms] shortcode.
     */
    public function register(): void
    {
        add_shortcode('subtleforms', [$this, 'render']);
    }

    /**
     * Render form shortcode.
     */
    public function render($atts): string
    {
        $atts = shortcode_atts([
            'id' => 0,
        ], $atts);

        $formId = intval($atts['id']);
        if ($formId <= 0) {
            return '<p class="subtleforms-error">Invalid form ID.</p>';
        }

        // Verify form exists
        $form = $this->formsRepo->find($formId);
        if (!$form) {
            return '<p class="subtleforms-error">Form not found.</p>';
        }

        // Only render published forms on frontend
        if ($form['status'] !== 'published') {
            return '<p class="subtleforms-error">This form is not published yet.</p>';
        }

        // Enqueue frontend assets
        $this->enqueueAssets();

        // Render container
        return sprintf(
            '<div class="subtleforms-form-container" data-form-id="%d"></div>',
            esc_attr($formId)
        );
    }

    /**
     * Enqueue frontend scripts and styles.
     */
    private function enqueueAssets(): void
    {
        static $enqueued = false;
        if ($enqueued) {
            return;
        }
        $enqueued = true;

        $asset_file = SUBTLEFORMS_PLUGIN_DIR . '/build/frontend/frontend.asset.php';
        $asset = file_exists($asset_file) ? require $asset_file : ['dependencies' => [], 'version' => '1.0.0'];

        wp_enqueue_script(
            'subtleforms-frontend',
            SUBTLEFORMS_PLUGIN_URL . 'build/frontend/frontend.js',
            $asset['dependencies'],
            $asset['version'],
            true
        );

        wp_localize_script('subtleforms-frontend', 'subtleformsFrontend', [
            'restUrl' => rest_url('subtleforms/v1'),
            'nonce' => wp_create_nonce('wp_rest'),
            'successMessage' => $this->settings ? $this->settings->get('success_message') : 'Thank you! Your submission has been received.',
            'errorMessage' => $this->settings ? $this->settings->get('error_message') : 'An error occurred. Please try again.',
            'redirectUrl' => $this->settings ? $this->settings->get('redirect_after_submit') : '',
        ]);

        wp_enqueue_style(
            'subtleforms-frontend',
            SUBTLEFORMS_PLUGIN_URL . 'build/frontend/index.jsx.css',
            [],
            $asset['version']
        );
    }
}
