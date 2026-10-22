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
		// Forms found before the page is drawn get their assets in the head
		// (2.6.0). Every other form still gets them when it renders.
		add_action( 'wp_enqueue_scripts', array( $this, 'enqueueDetected' ), 20 );
	}

	/**
	 * Enqueue the assets for the published forms this page is known to show
	 * (FormDetector). Pages without a form enqueue nothing.
	 */
	public function enqueueDetected(): void {
		if ( is_admin() ) {
			return;
		}
		foreach ( FormDetector::formIdsOnPage() as $formId ) {
			$form = $this->formsRepo->find( $formId );
			if ( is_array( $form ) && 'published' === ( $form['status'] ?? '' ) ) {
				$this->enqueueAssets( $formId );
				$schema = \SubtleForms\Engine\FormRestrictions::activeSchema( $formId );
				$schema = is_array( $schema ) ? $schema : null;
				// A closed or login-only form shows a message, not the form.
				if ( null === \SubtleForms\Engine\FormRestrictions::blockedReason( $formId, $schema ) ) {
					FrontendAssets::preloadSchema( $formId );
					FrontendAssets::preloadFieldCode( $schema );
				}
			}
		}
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

		// Render container, at the estimated height of the form so the page
		// does not jump when the form appears (UX2-27).
		$schema = \SubtleForms\Engine\FormRestrictions::activeSchema( $formId );
		$schema = is_array( $schema ) ? $schema : null;
		FrontendAssets::preloadSchema( $formId );
		FrontendAssets::preloadFieldCode( $schema );
		FrontendAssets::loadFieldTranslations( $schema );
		return sprintf(
			'<div class="subtleforms-form-container" data-form-id="%d"%s%s></div>',
			esc_attr( (string) $formId ),
			FormPlaceholder::attributes( $schema ),
			self::featuresAttribute( $schema )
		);
	}

	/**
	 * data-features: the field code groups the form needs (2.6.0).
	 *
	 * @param array<string, mixed>|null $schema Active schema.
	 * @return string Leading space and the attribute, or ''.
	 */
	public static function featuresAttribute( ?array $schema ): string {
		$groups = FrontendAssets::fieldGroups( $schema );
		return $groups ? sprintf( ' data-features="%s"', esc_attr( implode( ' ', $groups ) ) ) : '';
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
