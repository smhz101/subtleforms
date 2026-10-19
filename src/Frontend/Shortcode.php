<?php

declare(strict_types=1);

namespace SubtleForms\Frontend;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

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
			return '<p class="subtleforms-error">' . esc_html__( 'Invalid form ID.', 'subtleforms' ) . '</p>';
		}

		// Verify form exists
		$form = $this->formsRepo->find( $formId );
		if ( ! $form ) {
			return '<p class="subtleforms-error">' . esc_html__( 'Form not found.', 'subtleforms' ) . '</p>';
		}

		// Only render published forms on frontend
		if ( $form['status'] !== 'published' ) {
			return '<p class="subtleforms-error">' . esc_html__( 'This form is not published yet.', 'subtleforms' ) . '</p>';
		}

		// Login, schedule and entry-limit rules (2.0).
		$blocked = \SubtleForms\Engine\FormRestrictions::blockedReason( $formId, \SubtleForms\Engine\FormRestrictions::activeSchema( $formId ) );
		if ( $blocked !== null ) {
			$this->enqueueAssets( $formId );
			return \SubtleForms\Engine\FormRestrictions::render( $blocked );
		}

		// Enqueue frontend assets
		$this->enqueueAssets( $formId );

		// Render container
		return sprintf(
			'<div class="subtleforms-form-container" data-form-id="%d"></div>',
			esc_attr( (string) $formId )
		);
	}

	/**
	 * Enqueue frontend scripts and styles.
	 */
	private function enqueueAssets( int $formId = 0 ): void {
		$providers = array();
		if ( $formId > 0 ) {
			$schema = \SubtleForms\Engine\FormRestrictions::activeSchema( $formId );
			if ( is_array( $schema ) ) {
				foreach ( \SubtleForms\Support\Captcha\FieldCaptcha::fields( $schema ) as $field ) {
					$provider = \SubtleForms\Support\Captcha\FieldCaptcha::provider( $field );
					if ( '' !== $provider ) {
						$providers[] = $provider;
					}
				}
			}
		}
		FrontendAssets::enqueue( $this->settings, $this->captchaManager, $providers );
	}
}
