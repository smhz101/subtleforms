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

		// Reserve height before React mounts so the page footer does not jump (UX2-27).
		$schema     = \SubtleForms\Engine\FormRestrictions::activeSchema( $formId );
		$min_height = self::reserveHeight( is_array( $schema ) ? $schema : array() );

		return sprintf(
			'<div class="subtleforms-form-container" data-form-id="%d" style="min-height:%dpx" aria-busy="true"></div>',
			esc_attr( (string) $formId ),
			(int) $min_height
		);
	}

	/**
	 * Approximate min-height (px) for a schema so the layout does not shift when React mounts.
	 *
	 * @param array $schema Form schema.
	 * @return int
	 */
	public static function reserveHeight( array $schema ): int {
		$fields = isset( $schema['fields'] ) && is_array( $schema['fields'] ) ? $schema['fields'] : array();
		$count  = self::countVisibleFields( $fields );
		$height = 96 + ( $count * 72 );
		return max( 120, min( 960, $height ) );
	}

	/**
	 * @param array $fields Schema fields (may nest columns/repeaters).
	 * @return int
	 */
	private static function countVisibleFields( array $fields ): int {
		$count = 0;
		foreach ( $fields as $field ) {
			if ( ! is_array( $field ) ) {
				continue;
			}
			$type = isset( $field['type'] ) ? (string) $field['type'] : '';
			if ( in_array( $type, array( 'hidden', 'html', 'page_break', 'step' ), true ) ) {
				if ( ! empty( $field['fields'] ) && is_array( $field['fields'] ) ) {
					$count += self::countVisibleFields( $field['fields'] );
				}
				if ( ! empty( $field['children'] ) && is_array( $field['children'] ) ) {
					$count += self::countVisibleFields( $field['children'] );
				}
				continue;
			}
			$count++;
			foreach ( array( 'fields', 'children', 'columns' ) as $nested ) {
				if ( empty( $field[ $nested ] ) || ! is_array( $field[ $nested ] ) ) {
					continue;
				}
				if ( 'columns' === $nested ) {
					foreach ( $field[ $nested ] as $column ) {
						if ( is_array( $column ) ) {
							$count += self::countVisibleFields( $column );
						}
					}
				} else {
					$count += self::countVisibleFields( $field[ $nested ] );
				}
			}
		}
		return $count;
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
