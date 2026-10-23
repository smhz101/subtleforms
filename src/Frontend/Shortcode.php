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
					// A page that carries the form's data needs no hint to fetch it (2.6.1).
					if ( ! InlineData::enabled() ) {
						FrontendAssets::preloadSchema( $formId );
					}
					FrontendAssets::preloadFieldCode( $schema );
				}
			}
		}
	}

	/**
	 * What a visitor sees for a form that is missing, a draft or in the trash.
	 * One message for all three, so it does not say which forms exist.
	 */
	private static function unavailable(): string {
		return '<p class="subtleforms-error">' . esc_html__( 'Form not available.', 'subtleforms' ) . '</p>';
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
			return self::unavailable();
		}

		// Only render published forms on frontend
		if ( $form['status'] !== 'published' ) {
			return self::unavailable();
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
		$inline = self::inlineParts( $formId, $schema );
		FrontendAssets::preloadFieldCode( $schema );
		FrontendAssets::loadFieldTranslations( $schema );
		return sprintf(
			'<div class="subtleforms-form-container" data-form-id="%d"%s%s>%s</div>%s',
			esc_attr( (string) $formId ),
			FormPlaceholder::attributes( $schema ),
			self::featuresAttribute( $schema ),
			$inline['outline'],
			$inline['tag']
		);
	}

	/**
	 * What goes with a form's container (2.6.1): the form's data as a JSON
	 * script tag, so the script draws the form without a request, and the
	 * outline of the form for the container. When the data is not printed the
	 * browser is told to fetch it early instead (the head hint of 2.6.0).
	 *
	 * @param int                       $formId Form ID.
	 * @param array<string, mixed>|null $schema Active schema.
	 * @param bool                      $showTitle       Whether the title is shown.
	 * @param bool                      $showDescription Whether the description is shown.
	 * @return array{tag: string, outline: string}
	 */
	public static function inlineParts( int $formId, ?array $schema, bool $showTitle = true, bool $showDescription = true ): array {
		$payload = InlineData::enabled() ? InlineData::payload( $formId ) : null;
		$tag     = null === $payload ? '' : InlineData::tag( $formId, $payload );
		if ( ! InlineData::printed( $formId ) ) {
			FrontendAssets::preloadSchema( $formId );
		}
		$public = is_array( $payload['schema'] ?? null ) ? $payload['schema'] : $schema;
		return array(
			'tag'     => $tag,
			'outline' => Skeleton::html( $public, $showTitle, $showDescription ),
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
