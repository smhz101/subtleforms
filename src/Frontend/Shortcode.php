<?php
declare(strict_types=1);

namespace SubtleForms\Frontend;

use SubtleForms\Repositories\FormsRepository;
use SubtleForms\Support\Settings;
use SubtleForms\Support\Captcha\CaptchaManager;

/**
 * Frontend shortcode handler.
 */
final class Shortcode {

	private $formsRepo;
	private $settings;
	private $captchaManager;

	public function __construct( FormsRepository $formsRepo, ?Settings $settings = null, ?CaptchaManager $captchaManager = null ) {
		$this->formsRepo       = $formsRepo;
		$this->settings        = $settings;
		$this->captchaManager  = $captchaManager;
	}

	/**
	 * Register [subtleforms] shortcode.
	 */
	public function register(): void {
		add_shortcode( 'subtleforms', array( $this, 'render' ) );
	}

	/**
	 * Render form shortcode.
	 */
	public function render( $atts ): string {
		$atts = shortcode_atts(
			array(
				'id' => 0,
			),
			$atts
		);

		$formId = intval( $atts['id'] );
		if ( $formId <= 0 ) {
			return '<p class="subtleforms-error">Invalid form ID.</p>';
		}

		// Verify form exists
		$form = $this->formsRepo->find( $formId );
		if ( ! $form ) {
			return '<p class="subtleforms-error">Form not found.</p>';
		}

		// Only render published forms on frontend
		if ( $form['status'] !== 'published' ) {
			return '<p class="subtleforms-error">This form is not published yet.</p>';
		}

		// Enqueue frontend assets
		$this->enqueueAssets();

		// Render container
		return sprintf(
			'<div class="subtleforms-form-container" data-form-id="%d"></div>',
			esc_attr( (string) $formId )
		);
	}

	/**
	 * Enqueue frontend scripts and styles.
	 */
	private function enqueueAssets(): void {
		static $enqueued = false;
		if ( $enqueued ) {
			return;
		}
		$enqueued = true;

		$asset_file = SUBTLEFORMS_PLUGIN_DIR . '/build/frontend/frontend.asset.php';
		$asset      = file_exists( $asset_file ) ? require $asset_file : array(
			'dependencies' => array(),
			'version'      => '1.0.0',
		);

		wp_enqueue_script(
			'subtleforms-frontend',
			SUBTLEFORMS_PLUGIN_URL . 'build/frontend/frontend.js',
			$asset['dependencies'],
			$asset['version'],
			true
		);

		wp_localize_script(
			'subtleforms-frontend',
			'subtleformsFrontend',
			array(
				'restUrl'        => rest_url( 'subtleforms/v1' ),
				'nonce'          => wp_create_nonce( 'wp_rest' ),
				'successMessage' => $this->settings ? $this->settings->get( 'success_message' ) : 'Thank you! Your submission has been received.',
				'errorMessage'   => $this->settings ? $this->settings->get( 'error_message' ) : 'An error occurred. Please try again.',
				'redirectUrl'    => $this->settings ? $this->settings->get( 'redirect_after_submit' ) : '',
			)
		);

		wp_enqueue_style(
			'subtleforms-frontend',
			SUBTLEFORMS_PLUGIN_URL . 'build/frontend/index.jsx.css',
			array(),
			$asset['version']
		);

		// Enqueue CAPTCHA provider script if enabled and configured
		if ( $this->captchaManager && $this->captchaManager->isEnabled() && $this->captchaManager->isConfigured() ) {
			$script_url = $this->captchaManager->getScriptUrl();
			if ( ! empty( $script_url ) ) {
				wp_enqueue_script(
					'subtleforms-captcha',
					$script_url,
					array(),
					null,
					true
				);
			}
		}
	}
}
