<?php
/**
 * Space kept for a form before the renderer draws it (UX2-27).
 *
 * The shortcode and the block print an empty container that the renderer
 * fills a moment later. Without a height, everything under the form (the
 * rest of the post, the footer) jumps down when it appears: a layout shift
 * of 0.2 on a desktop and 0.5 on a phone. The container now starts at the
 * estimated height of the form's first page, on a wide and a narrow screen,
 * and the renderer releases it once the form is drawn.
 *
 * The heights are those of the default form style (no padding of its own,
 * 2.4.1); a theme-styled form is close enough that the shift stays small.
 *
 * @package SubtleForms
 * @since   2.4.1
 */

namespace SubtleForms\Frontend;

defined( 'ABSPATH' ) || exit;

/**
 * Estimates the first-page height of a form.
 */
final class FormPlaceholder {

	/** Space between two rows of fields. */
	private const GAP = 44;

	/** Title and description above the fields. */
	private const HEADER = 64;

	/** Title, description and the step progress of a multi-step form: wide, narrow. */
	private const HEADER_STEPS = array( 328, 302 );

	/** Space under the fields and the submit row. */
	private const FOOTER = 24 + 72;

	/** Space under the fields, the step buttons and the submit row of a multi-step form. */
	private const FOOTER_STEPS = 48 + 107;

	/** One question at a time: wide, narrow. */
	private const CONVERSATIONAL = array( 525, 425 );

	/** Largest height kept, so a broken estimate cannot leave a huge gap. */
	private const MAX = 4000;

	/**
	 * Heights by field type on a wide screen (default style).
	 */
	private const HEIGHTS = array(
		'textarea'           => 138,
		'rich_text'          => 220,
		'consent'            => 62,
		'disclaimer'         => 120,
		'html'               => 60,
		'section_break'      => 48,
		'image_upload'       => 140,
		'file_upload'        => 140,
		'rating'             => 80,
		'net_promoter_score' => 110,
		'range_slider'       => 86,
		'checkbox_grid'      => 180,
		'recaptcha'          => 100,
		'hcaptcha'           => 100,
		'turnstile'          => 90,
		'name_group'         => 72,
		'address_group'      => 304,
		'payment_summary'    => 120,
	);

	/** Types that draw nothing. */
	private const HIDDEN = array( 'hidden', 'payment_hidden_price', 'action_hook', 'form_step', 'save_resume' );

	/** Types listing their options one per line. */
	private const CHOICES = array( 'radio', 'checkbox', 'multiple_choice', 'post_selection' );

	/**
	 * Wide and narrow heights for a schema, in pixels.
	 *
	 * @param array<string, mixed> $schema    Active schema.
	 * @param bool                 $showTitle Whether the title is shown.
	 * @return array{wide: int, narrow: int}
	 */
	public static function estimate( array $schema, bool $showTitle = true ): array {
		$type = (string) ( $schema['metadata']['type'] ?? 'regular' );
		if ( 'conversational' === $type ) {
			return array(
				'wide'   => self::CONVERSATIONAL[0],
				'narrow' => self::CONVERSATIONAL[1],
			);
		}

		$fields = is_array( $schema['fields'] ?? null ) ? $schema['fields'] : array();
		$steps  = false;
		list( $fields, $steps ) = self::firstPage( $fields );

		$wide_header   = $steps ? self::HEADER_STEPS[0] : self::HEADER;
		$narrow_header = $steps ? self::HEADER_STEPS[1] : self::HEADER;
		if ( ! $showTitle ) {
			$wide_header   -= 40;
			$narrow_header -= 40;
		}
		$footer = $steps ? self::FOOTER_STEPS : self::FOOTER;

		$wide   = $wide_header + self::rows( $fields, false ) + $footer;
		$narrow = $narrow_header + self::rows( $fields, true ) + $footer;

		return array(
			'wide'   => (int) min( self::MAX, max( 0, $wide ) ),
			'narrow' => (int) min( self::MAX, max( 0, $narrow ) ),
		);
	}

	/**
	 * The style and data attributes for the container.
	 *
	 * @param array<string, mixed>|null $schema    Active schema.
	 * @param bool                      $showTitle Whether the title is shown.
	 * @return string Leading space, then the attributes; empty without a schema.
	 */
	public static function attributes( ?array $schema, bool $showTitle = true ): string {
		if ( ! is_array( $schema ) ) {
			return '';
		}
		$h = self::estimate( $schema, $showTitle );
		return sprintf(
			' data-reserve="1" style="%s"',
			esc_attr( sprintf( '--subtleforms-reserve:%dpx;--subtleforms-reserve-narrow:%dpx', $h['wide'], $h['narrow'] ) )
		);
	}

	/**
	 * Fields on the first page, and whether the form has steps.
	 *
	 * @param array<int, mixed> $fields Top-level fields.
	 * @return array{0: array<int, mixed>, 1: bool}
	 */
	private static function firstPage( array $fields ): array {
		// Steps as containers.
		foreach ( $fields as $field ) {
			if ( is_array( $field ) && 'step' === ( $field['type'] ?? '' ) ) {
				return array( self::children( $field ), true );
			}
		}
		// Steps as page breaks.
		$page = array();
		foreach ( $fields as $field ) {
			if ( is_array( $field ) && 'form_step' === ( $field['type'] ?? '' ) ) {
				return array( $page, true );
			}
			$page[] = $field;
		}
		return array( $page, false );
	}

	/**
	 * Height of a list of fields laid out in rows.
	 *
	 * @param array<int, mixed> $fields Fields.
	 * @param bool              $narrow Narrow screen (every field on its own row).
	 * @return int
	 */
	private static function rows( array $fields, bool $narrow ): int {
		$rows  = array();
		$row   = 0;
		$used  = 0;
		foreach ( $fields as $field ) {
			if ( ! is_array( $field ) || self::startsHidden( $field ) ) {
				continue;
			}
			$h = self::height( $field, $narrow );
			if ( $h <= 0 ) {
				continue;
			}
			$width = $narrow ? 100 : self::width( $field );
			if ( $used > 0 && $used + $width <= 100 ) {
				$row   = max( $row, $h );
				$used += $width;
				continue;
			}
			if ( $used > 0 ) {
				$rows[] = $row;
			}
			$row  = $h;
			$used = $width;
		}
		if ( $used > 0 ) {
			$rows[] = $row;
		}
		if ( ! $rows ) {
			return 0;
		}
		return (int) array_sum( $rows ) + self::GAP * ( count( $rows ) - 1 );
	}

	/**
	 * Height of one field.
	 *
	 * @param array<string, mixed> $field  Field.
	 * @param bool                 $narrow Narrow screen.
	 * @return int
	 */
	private static function height( array $field, bool $narrow ): int {
		$type = (string) ( $field['type'] ?? '' );
		if ( in_array( $type, self::HIDDEN, true ) ) {
			return 0;
		}
		if ( ! empty( $field['columns'] ) && is_array( $field['columns'] ) ) {
			$cols = array();
			foreach ( $field['columns'] as $column ) {
				$cols[] = self::rows( is_array( $column ) ? self::children( $column ) : array(), $narrow );
			}
			return $narrow ? (int) array_sum( $cols ) + self::GAP * max( 0, count( $cols ) - 1 ) : (int) max( $cols ?: array( 0 ) );
		}
		$children = self::children( $field );
		if ( $children ) {
			return 40 + self::rows( $children, $narrow );
		}
		if ( in_array( $type, self::CHOICES, true ) ) {
			$count = is_array( $field['options'] ?? null ) ? count( $field['options'] ) : 3;
			return 32 + 31 * max( 1, $count );
		}
		if ( 'address_group' === $type && $narrow ) {
			return 420;
		}
		if ( 'name_group' === $type && $narrow ) {
			return 72 * 2 + self::GAP;
		}
		return self::HEIGHTS[ $type ] ?? 72;
	}

	/**
	 * Child fields of a container, a step or a column.
	 *
	 * @param array<string, mixed> $node Node.
	 * @return array<int, mixed>
	 */
	private static function children( array $node ): array {
		foreach ( array( 'fields', 'children' ) as $key ) {
			if ( ! empty( $node[ $key ] ) && is_array( $node[ $key ] ) ) {
				return array_values( $node[ $key ] );
			}
		}
		return array();
	}

	/**
	 * Width of a field in percent.
	 *
	 * @param array<string, mixed> $field Field.
	 * @return int
	 */
	private static function width( array $field ): int {
		$width = (int) ( $field['appearance']['width'] ?? $field['width'] ?? 100 );
		return ( $width > 0 && $width <= 100 ) ? $width : 100;
	}

	/**
	 * Whether conditional logic hides the field until a rule matches.
	 *
	 * @param array<string, mixed> $field Field.
	 * @return bool
	 */
	private static function startsHidden( array $field ): bool {
		return ! empty( $field['logic']['groups'] ) && 'show' === ( $field['logic']['action'] ?? '' );
	}
}
