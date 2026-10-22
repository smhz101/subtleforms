<?php
/**
 * The outline of a form, printed by the server (2.6.1).
 *
 * Until the script has run, a form's container was an empty box. Now it holds
 * the form's real title and labels with empty boxes where the fields go, laid
 * out in the form's own widths, so the page shows the shape of the form while
 * the script loads and there is nothing to jump when the form replaces it.
 * Only the first page of a multi-step form and the first question of a
 * conversational form are outlined, as in FormPlaceholder.
 *
 * It is plain HTML with no inputs, so nothing in it can be focused or
 * submitted, and it is hidden from screen readers: the renderer's own form is
 * what they read.
 *
 * @package SubtleForms
 * @since   2.6.1
 */

namespace SubtleForms\Frontend;

defined( 'ABSPATH' ) || exit;

/**
 * Builds the outline markup.
 */
final class Skeleton {

	/** Most fields outlined, so a long form does not print a long outline. */
	private const MAX_FIELDS = 24;

	/** Types that draw no label and no box of their own. */
	private const HIDDEN = array( 'hidden', 'payment_hidden_price', 'action_hook', 'form_step', 'save_resume', 'html', 'section_break', 'disclaimer' );

	/** Types listing their options one per line. */
	private const CHOICES = array( 'radio', 'checkbox', 'multiple_choice', 'post_selection' );

	/** Types drawn as a tall box. */
	private const TALL = array( 'textarea', 'rich_text' );

	/**
	 * The outline for a form.
	 *
	 * @param array<string, mixed>|null $schema          Public or active schema.
	 * @param bool                      $showTitle       Whether the title is shown.
	 * @param bool                      $showDescription Whether the description is shown.
	 * @return string Markup, or '' without a schema.
	 */
	public static function html( ?array $schema, bool $showTitle = true, bool $showDescription = true ): string {
		if ( ! is_array( $schema ) ) {
			return '';
		}
		$meta = is_array( $schema['metadata'] ?? null ) ? $schema['metadata'] : array();
		$out  = '';

		$title = trim( (string) ( $meta['title'] ?? '' ) );
		if ( $showTitle && '' !== $title ) {
			$out .= '<p class="subtleforms-skeleton__title">' . esc_html( $title ) . '</p>';
		}
		$description = trim( wp_strip_all_tags( (string) ( $meta['description'] ?? '' ) ) );
		if ( $showDescription && '' !== $description ) {
			$out .= '<p class="subtleforms-skeleton__description">' . esc_html( $description ) . '</p>';
		}

		$fields = is_array( $schema['fields'] ?? null ) ? $schema['fields'] : array();
		$leaves = array();
		self::collect( self::firstPage( $fields ), $leaves );
		if ( 'conversational' === strtolower( (string) ( $meta['type'] ?? '' ) ) ) {
			$leaves = array_slice( $leaves, 0, 1 );
		}
		foreach ( array_slice( $leaves, 0, self::MAX_FIELDS ) as $field ) {
			$out .= self::field( $field );
		}

		if ( 'conversational' !== strtolower( (string) ( $meta['type'] ?? '' ) ) ) {
			$out .= '<div class="subtleforms-skeleton__action"><span class="subtleforms-skeleton__button"></span></div>';
		}

		if ( '' === $out ) {
			return '';
		}
		return '<div class="subtleforms-skeleton" aria-hidden="true">' . $out . '</div>';
	}

	/**
	 * One field: its label and a box the shape of its control.
	 *
	 * @param array<string, mixed> $field Field.
	 * @return string
	 */
	private static function field( array $field ): string {
		$type  = (string) ( $field['type'] ?? '' );
		$label = self::label( $field );
		$width = (int) ( $field['appearance']['width'] ?? $field['width'] ?? 100 );
		$style = ( $width > 0 && $width < 100 ) ? ' style="' . esc_attr( 'flex-basis:calc(' . $width . '% - var(--subtleforms-field-gap, 20px))' ) . '"' : '';

		$html = '<div class="subtleforms-skeleton__field"' . $style . '>';
		if ( '' !== $label ) {
			$html .= '<span class="subtleforms-skeleton__label">' . esc_html( $label ) . '</span>';
		}
		if ( in_array( $type, self::CHOICES, true ) ) {
			$count = is_array( $field['options'] ?? null ) ? count( $field['options'] ) : 3;
			$html .= str_repeat( '<span class="subtleforms-skeleton__control subtleforms-skeleton__control--choice"></span>', max( 1, min( 5, $count ) ) );
		} elseif ( in_array( $type, self::TALL, true ) ) {
			$html .= '<span class="subtleforms-skeleton__control subtleforms-skeleton__control--textarea"></span>';
		} else {
			$html .= '<span class="subtleforms-skeleton__control"></span>';
		}
		return $html . '</div>';
	}

	/**
	 * The text of a field's label.
	 *
	 * @param array<string, mixed> $field Field.
	 * @return string
	 */
	private static function label( array $field ): string {
		$config = is_array( $field['config'] ?? null ) ? $field['config'] : array();
		$label  = $field['label'] ?? $config['label'] ?? '';
		return is_string( $label ) ? trim( wp_strip_all_tags( $label ) ) : '';
	}

	/**
	 * Fields on the first page: the first step's fields, the fields before the
	 * first page break, or all of them.
	 *
	 * @param array<int, mixed> $fields Top-level fields.
	 * @return array<int, mixed>
	 */
	private static function firstPage( array $fields ): array {
		foreach ( $fields as $field ) {
			if ( is_array( $field ) && 'step' === ( $field['type'] ?? '' ) ) {
				return self::children( $field );
			}
		}
		$page = array();
		foreach ( $fields as $field ) {
			if ( is_array( $field ) && 'form_step' === ( $field['type'] ?? '' ) ) {
				return $page;
			}
			$page[] = $field;
		}
		return $page;
	}

	/**
	 * Flatten containers and columns into the fields inside them.
	 *
	 * @param array<int, mixed>                $fields Fields.
	 * @param array<int, array<string, mixed>> $leaves Collected fields.
	 */
	private static function collect( array $fields, array &$leaves ): void {
		foreach ( $fields as $field ) {
			if ( ! is_array( $field ) || count( $leaves ) >= self::MAX_FIELDS ) {
				continue;
			}
			$type = (string) ( $field['type'] ?? '' );
			if ( in_array( $type, self::HIDDEN, true ) ) {
				continue;
			}
			// Conditional logic that shows the field only when a rule matches.
			if ( ! empty( $field['logic']['groups'] ) && 'show' === ( $field['logic']['action'] ?? '' ) ) {
				continue;
			}
			if ( ! empty( $field['columns'] ) && is_array( $field['columns'] ) ) {
				foreach ( $field['columns'] as $column ) {
					self::collect( is_array( $column ) ? ( array_is_list( $column ) ? $column : self::children( $column ) ) : array(), $leaves );
				}
				continue;
			}
			$children = self::children( $field );
			if ( $children ) {
				self::collect( $children, $leaves );
				continue;
			}
			$leaves[] = $field;
		}
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
}
