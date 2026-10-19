<?php
/**
 * One formatter for every place an answer is read by a person.
 *
 * The entry screen, notification emails, the CSV export, the PDF data and
 * integrations all turn a stored answer into text here, so they read the
 * same (2.4.0):
 *
 * - Choice fields show option labels, not stored values.
 * - Single checkbox, consent and toggle answers read Yes or No.
 * - A matrix names its rows and columns ("Speed: Good; Price: OK").
 * - A chained select shows the label chosen at each level.
 * - Dates and times follow the field's display format.
 * - Uploads read as file names, with admin download links when asked.
 * - Payment fields show option labels and product lines with prices.
 * - Field names use the admin label, and a long public label is shortened.
 *
 * Pure PHP apart from optional WordPress helpers (guarded), so the rules are
 * unit tested in isolation.
 *
 * @package SubtleForms\Support
 * @since   2.4.0
 */

namespace SubtleForms\Support;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Formats stored answers as display text.
 */
final class AnswerFormatter {

	/**
	 * Longest field name used in outputs before it is shortened.
	 */
	public const LABEL_MAX = 60;

	/**
	 * Field types that store a yes/no answer.
	 */
	private const YES_NO_TYPES = array( 'consent', 'checkbox', 'toggle' );

	/**
	 * Default display formats by field type (the field definitions' defaults).
	 */
	private const DATE_FORMATS = array(
		'date'     => 'Y-m-d',
		'time'     => 'H:i',
		'datetime' => 'Y-m-d H:i',
	);

	/**
	 * Currency symbols used in product lines; other currencies show the code.
	 */
	private const SYMBOLS = array(
		'USD' => '$',
		'EUR' => "\u{20AC}",
		'GBP' => "\u{00A3}",
		'CAD' => 'CA$',
		'AUD' => 'A$',
		'JPY' => "\u{00A5}",
		'INR' => "\u{20B9}",
	);

	/**
	 * The name of a field in outputs: its admin label when set, else its
	 * public label shortened to LABEL_MAX characters, else its key.
	 *
	 * @param array  $node Field node (flat or wrapped in `config`).
	 * @param string $key  Field key.
	 * @return string
	 */
	public static function label( array $node, string $key = '' ): string {
		$admin = $node['adminLabel'] ?? ( $node['config']['adminLabel'] ?? '' );
		if ( is_string( $admin ) && '' !== trim( $admin ) ) {
			return trim( $admin );
		}
		$label = $node['label'] ?? ( $node['config']['label'] ?? '' );
		if ( is_string( $label ) && '' !== trim( $label ) ) {
			return self::shorten( $label );
		}
		return '' !== $key ? $key : (string) ( $node['key'] ?? ( $node['config']['key'] ?? '' ) );
	}

	/**
	 * Shorten a label for use as a line label, column header or message.
	 *
	 * Tags are removed and white space collapsed. A label longer than $max
	 * characters is cut at the last word that fits and ends with an ellipsis.
	 *
	 * @param string $label Label.
	 * @param int    $max   Longest length kept.
	 * @return string
	 */
	public static function shorten( string $label, int $max = self::LABEL_MAX ): string {
		$text = trim( (string) preg_replace( '/\s+/u', ' ', wp_strip_all_tags( $label ) ) );
		if ( self::length( $text ) <= $max ) {
			return $text;
		}
		$cut   = self::slice( $text, $max - 1 );
		$space = strrpos( $cut, ' ' );
		if ( false !== $space && $space > (int) ( strlen( $cut ) / 2 ) ) {
			$cut = substr( $cut, 0, $space );
		}
		return rtrim( $cut, " \t,.;:" ) . "\u{2026}";
	}

	/**
	 * Display context for a form: the currency used for prices.
	 *
	 * @param mixed $schema Form schema.
	 * @param array $extra  More context (submission_id, links, signature).
	 * @return array
	 */
	public static function context( $schema, array $extra = array() ): array {
		$currency = '';
		if ( is_array( $schema ) && class_exists( '\SubtleForms\Payments\Pricing' ) ) {
			$currency = \SubtleForms\Payments\Pricing::currency( $schema );
		}
		return $extra + array( 'currency' => $currency );
	}

	/**
	 * The currency an entry was priced in, from its stored order (or payment).
	 * Empty when the entry has no order.
	 *
	 * @param mixed $submission Submission row (meta as an array or JSON).
	 * @return string ISO code.
	 */
	public static function entryCurrency( $submission ): string {
		$meta = is_array( $submission ) ? ( $submission['meta'] ?? array() ) : array();
		if ( is_string( $meta ) ) {
			$decoded = json_decode( $meta, true );
			$meta    = is_array( $decoded ) ? $decoded : array();
		}
		if ( ! is_array( $meta ) ) {
			return '';
		}
		$code = $meta['order']['currency'] ?? ( $meta['payment']['currency'] ?? '' );
		return is_string( $code ) ? strtoupper( trim( $code ) ) : '';
	}

	/**
	 * Display context for one entry: prices in the currency the entry was
	 * charged in, so a later change of the site or form currency does not
	 * relabel older answers. Falls back to the form currency.
	 *
	 * @param mixed $schema     Form schema.
	 * @param mixed $submission Submission row.
	 * @param array $extra      More context.
	 * @return array
	 */
	public static function entryContext( $schema, $submission, array $extra = array() ): array {
		$currency = self::entryCurrency( $submission );
		if ( '' !== $currency ) {
			$extra['currency'] = $currency;
		}
		return self::context( $schema, $extra );
	}

	/**
	 * A stored answer as display text.
	 *
	 * Context keys:
	 * - submission_id (int)  Entry ID, for upload download links.
	 * - links (bool)         Add download links after file names.
	 * - signature (string)   'long' (default), 'short' ("Signed") or 'raw'
	 *                        (the image data, for renderers that draw it).
	 * - currency (string)    Currency code for prices.
	 *
	 * @param mixed $value   Stored value.
	 * @param array $field   Field node.
	 * @param array $context Display context.
	 * @return string
	 */
	public static function text( $value, array $field, array $context = array() ): string {
		$type = (string) ( $field['type'] ?? '' );

		if ( EntryValues::isSignatureImage( $value ) ) {
			$mode = (string) ( $context['signature'] ?? 'long' );
			if ( 'raw' === $mode ) {
				return (string) $value;
			}
			return 'short' === $mode
				? __( 'Signed', 'subtleforms' )
				: __( 'Signed (the signature image is in the entry)', 'subtleforms' );
		}
		if ( 'password' === $type ) {
			return EntryValues::passwordLabel( $value );
		}
		if ( Repeater::TYPE === $type ) {
			return Repeater::toText( $value, $field, $context );
		}
		if ( 'rich_text' === $type && is_string( $value ) ) {
			$text = preg_replace( '#<\s*(br|/p|/li)\s*/?>#i', "\n", $value );
			return trim( html_entity_decode( wp_strip_all_tags( (string) $text ), ENT_QUOTES, 'UTF-8' ) );
		}
		if ( 'checkbox_grid' === $type && is_array( $value ) ) {
			return self::matrix( $value, $field );
		}

		// One choice may be stored on its own rather than in a list.
		if ( 'chained_select' === $type && is_scalar( $value ) && '' !== (string) $value ) {
			$value = array( $value );
		}
		if ( 'payment_choice' === $type && is_scalar( $value ) && '' !== (string) $value ) {
			$value = array_map( 'trim', explode( ',', (string) $value ) );
		}

		$items = self::items( $value, $field, $context );
		if ( null !== $items ) {
			return implode( self::isUploadList( $value ) && ! empty( $context['links'] ) ? "\n" : ', ', $items );
		}

		if ( null === $value ) {
			return '';
		}
		if ( in_array( $type, array( 'date', 'time', 'datetime' ), true ) && is_string( $value ) ) {
			return self::date( $value, $type, $field );
		}
		if ( 'payment_product' === $type ) {
			return self::product( $value, $field, $context );
		}
		if ( self::isYesNo( $field ) && ! is_array( $value ) ) {
			if ( '' === $value && 'consent' !== $type ) {
				return '';
			}
			return FieldMapper::isChecked( $value, $field ) ? __( 'Yes', 'subtleforms' ) : __( 'No', 'subtleforms' );
		}

		return FieldMapper::toText( FieldMapper::optionLabels( $value, $field ) );
	}

	/**
	 * A list answer as one display string per item, or null when the answer
	 * is not a list (or is a list that reads as one value, like a name).
	 *
	 * @param mixed $value   Stored value.
	 * @param array $field   Field node.
	 * @param array $context Display context.
	 * @return string[]|null
	 */
	public static function items( $value, array $field, array $context = array() ): ?array {
		if ( ! is_array( $value ) || array() === $value || array_keys( $value ) !== range( 0, count( $value ) - 1 ) ) {
			return null;
		}
		$type = (string) ( $field['type'] ?? '' );
		if ( Repeater::TYPE === $type || Repeater::looksLikeGroups( $value ) && ! self::isUploadList( $value ) ) {
			return null;
		}

		if ( self::isUploadList( $value ) ) {
			$out = array();
			foreach ( $value as $file ) {
				$name = trim( (string) $file['name'] );
				$id   = (int) ( $context['submission_id'] ?? 0 );
				$out[] = ! empty( $context['links'] ) && $id > 0 && class_exists( '\SubtleForms\Uploads\Uploads' ) && function_exists( 'admin_url' )
					? sprintf( '%s (%s)', $name, \SubtleForms\Uploads\Uploads::downloadUrl( $id, (string) $file['id'] ) )
					: $name;
			}
			return $out;
		}

		if ( 'chained_select' === $type ) {
			return array_values( array_filter( self::chained( $value, $field ), static fn( $t ) => '' !== $t ) );
		}

		$labels = self::optionMap( $field );
		$out    = array();
		foreach ( $value as $item ) {
			if ( is_scalar( $item ) && isset( $labels[ (string) $item ] ) ) {
				$text = $labels[ (string) $item ];
				if ( 'payment_choice' === $type ) {
					$text = self::withPrice( $text, self::optionPrice( $field, (string) $item ), $context );
				}
			} elseif ( is_scalar( $item ) && self::isYesNo( $field ) && empty( $labels ) ) {
				$text = FieldMapper::isChecked( $item, $field ) ? __( 'Yes', 'subtleforms' ) : __( 'No', 'subtleforms' );
			} else {
				$text = FieldMapper::toText( $item );
			}
			if ( '' !== $text ) {
				$out[] = $text;
			}
		}
		return $out;
	}

	/**
	 * A stored answer as HTML for an HTML email: line breaks become <br>,
	 * rich text keeps its allowed tags, everything else is escaped.
	 *
	 * @param mixed $value   Stored value.
	 * @param array $field   Field node.
	 * @param array $context Display context.
	 * @return string
	 */
	public static function html( $value, array $field, array $context = array() ): string {
		$type = (string) ( $field['type'] ?? '' );
		if ( EntryValues::isSignatureImage( $value ) ) {
			return '<img src="' . esc_attr( (string) $value ) . '" alt="' . esc_attr__( 'Signature', 'subtleforms' ) . '" width="240" style="max-width:240px;height:auto;border:1px solid #e5e7eb;background:#fff;" />';
		}
		if ( 'rich_text' === $type && is_string( $value ) ) {
			return \SubtleForms\Validation\Sanitizer::sanitizeRichText( $value );
		}
		if ( Repeater::TYPE === $type ) {
			return Repeater::toHtml( $value, $field, $context );
		}
		return nl2br( esc_html( self::text( $value, $field, $context ) ) );
	}

	/**
	 * Display text for one field's answer, with the field found in a schema.
	 * Unknown keys fall back to schema-free text.
	 *
	 * @param array  $schema  Form schema.
	 * @param string $key     Field key.
	 * @param mixed  $value   Stored value.
	 * @param array  $context Display context.
	 * @return string
	 */
	public static function forKey( array $schema, string $key, $value, array $context = array() ): string {
		foreach ( FieldMapper::fields( $schema ) as $entry ) {
			if ( $entry['key'] === $key ) {
				return self::text( $value, $entry['field'], $context );
			}
		}
		return FieldMapper::toText( $value );
	}

	/**
	 * Entry screen data: per answer key, its field name, display text and,
	 * for list answers, one string per item. Repeater answers carry their
	 * columns and one row of cell text per group.
	 *
	 * @param array $schema  Form schema.
	 * @param array $payload Stored answers.
	 * @param array $context Display context.
	 * @return array<string,array>
	 */
	public static function display( array $schema, array $payload, array $context = array() ): array {
		$fields = array();
		foreach ( FieldMapper::fields( $schema ) as $entry ) {
			$fields[ $entry['key'] ] = $entry;
		}
		$context = self::context( $schema, $context );
		$out     = array();
		foreach ( $payload as $key => $value ) {
			$key   = (string) $key;
			$entry = $fields[ $key ] ?? null;
			$field = $entry ? $entry['field'] : array();
			$row   = array(
				'label' => $entry ? $entry['label'] : $key,
				'text'  => $entry ? self::text( $value, $field, $context ) : FieldMapper::toText( $value ),
			);
			$items = $entry ? self::items( $value, $field, $context ) : null;
			if ( null !== $items ) {
				$row['items'] = $items;
			}
			if ( $entry && Repeater::TYPE === $entry['type'] ) {
				$columns = array();
				foreach ( Repeater::childFields( $field ) as $child ) {
					$columns[] = array(
						'key'   => $child['key'],
						'label' => '' !== $child['label'] ? $child['label'] : $child['key'],
					);
				}
				$cells = array();
				foreach ( Repeater::groups( $value ) as $group ) {
					$line = array();
					foreach ( Repeater::childFields( $field ) as $child ) {
						$line[ $child['key'] ] = array_key_exists( $child['key'], $group )
							? self::text( $group[ $child['key'] ], $child['field'], $context )
							: '';
					}
					$cells[] = $line;
				}
				$row['columns'] = $columns;
				$row['cells']   = $cells;
			}
			$out[ $key ] = $row;
		}
		return $out;
	}

	/**
	 * Answers with each dependent dropdown answer replaced by the label
	 * chosen at each level, including inside Repeater groups. Every other
	 * answer is left as stored. Used for the webhook "full" payload, which
	 * otherwise sends answers as stored.
	 *
	 * @param array $schema  Form schema.
	 * @param array $payload Stored answers.
	 * @return array
	 */
	public static function withChainedLabels( array $schema, array $payload ): array {
		foreach ( FieldMapper::fields( $schema ) as $entry ) {
			$key = $entry['key'];
			if ( ! array_key_exists( $key, $payload ) ) {
				continue;
			}
			if ( 'chained_select' === $entry['type'] && is_array( $payload[ $key ] ) ) {
				$payload[ $key ] = self::chained( $payload[ $key ], $entry['field'] );
				continue;
			}
			if ( Repeater::TYPE === $entry['type'] && is_array( $payload[ $key ] ) ) {
				foreach ( $payload[ $key ] as $index => $group ) {
					if ( ! is_array( $group ) ) {
						continue;
					}
					foreach ( Repeater::childFields( $entry['field'] ) as $child ) {
						$childKey = $child['key'];
						if ( 'chained_select' === $child['type'] && isset( $group[ $childKey ] ) && is_array( $group[ $childKey ] ) ) {
							$payload[ $key ][ $index ][ $childKey ] = self::chained( $group[ $childKey ], $child['field'] );
						}
					}
				}
			}
		}
		return $payload;
	}

	// ── Field types ──────────────────────────────────────────────────────

	/**
	 * Whether a field stores a yes/no answer: consent, toggle, or a single
	 * checkbox (an older checkbox with options is a checkbox group).
	 *
	 * @param array $field Field node.
	 */
	private static function isYesNo( array $field ): bool {
		$type = (string) ( $field['type'] ?? '' );
		if ( ! in_array( $type, self::YES_NO_TYPES, true ) ) {
			return false;
		}
		return 'checkbox' !== $type || empty( self::optionMap( $field ) );
	}

	/**
	 * Whether a value is a list of stored upload records.
	 *
	 * @param mixed $value Value.
	 */
	private static function isUploadList( $value ): bool {
		if ( ! is_array( $value ) || ! $value || ! class_exists( '\SubtleForms\Uploads\Uploads' ) ) {
			return false;
		}
		foreach ( $value as $item ) {
			if ( ! \SubtleForms\Uploads\Uploads::isRecord( $item ) ) {
				return false;
			}
		}
		return true;
	}

	/**
	 * Option value => label for a choice field.
	 *
	 * @param array $field Field node.
	 * @return array<string,string>
	 */
	private static function optionMap( array $field ): array {
		$options = EntryValues::attr( $field, 'options' );
		$labels  = array();
		if ( ! is_array( $options ) ) {
			return $labels;
		}
		foreach ( $options as $option ) {
			if ( is_array( $option ) && isset( $option['value'] ) && is_scalar( $option['value'] ) ) {
				$label                                 = $option['label'] ?? $option['value'];
				$labels[ (string) $option['value'] ] = wp_strip_all_tags( (string) ( '' !== (string) $label ? $label : $option['value'] ) );
			}
		}
		return $labels;
	}

	/**
	 * The price of one option of a payment choice field.
	 *
	 * @param array  $field Field node.
	 * @param string $value Option value.
	 */
	private static function optionPrice( array $field, string $value ): float {
		foreach ( (array) EntryValues::attr( $field, 'options' ) as $option ) {
			if ( is_array( $option ) && (string) ( $option['value'] ?? '' ) === $value ) {
				return is_numeric( $option['price'] ?? null ) ? (float) $option['price'] : 0.0;
			}
		}
		return 0.0;
	}

	/**
	 * A matrix answer with its row and column names.
	 *
	 * One answer per row (`{ row: column }`) reads "Speed: Good; Price: OK".
	 * Several per row (`{ row: { column: true } }`) reads "Mon: AM, PM".
	 * Rows and columns may be plain strings or { label, value } pairs.
	 *
	 * @param array $value Stored grid.
	 * @param array $field Field node.
	 * @return string
	 */
	private static function matrix( array $value, array $field ): string {
		$rowNames = self::gridNames( EntryValues::attr( $field, 'rows' ) );
		$colNames = self::gridNames( EntryValues::attr( $field, 'columns' ) );

		// Rows in the order the form shows them, then any others stored.
		$order = array_keys( $rowNames );
		foreach ( array_keys( $value ) as $k ) {
			if ( ! in_array( (string) $k, $order, true ) ) {
				$order[] = (string) $k;
			}
		}

		$lines = array();
		foreach ( $order as $rowKey ) {
			if ( ! array_key_exists( $rowKey, $value ) ) {
				continue;
			}
			$answer = $value[ $rowKey ];
			$chosen = array();
			if ( is_array( $answer ) ) {
				$isList = array_keys( $answer ) === range( 0, count( $answer ) - 1 );
				foreach ( $answer as $col => $on ) {
					$colKey = $isList ? $on : $col;
					if ( ! $isList && ! FieldMapper::isChecked( $on ) ) {
						continue;
					}
					if ( is_scalar( $colKey ) && '' !== (string) $colKey ) {
						$chosen[] = $colNames[ (string) $colKey ] ?? (string) $colKey;
					}
				}
			} elseif ( is_scalar( $answer ) && '' !== (string) $answer ) {
				$chosen[] = $colNames[ (string) $answer ] ?? (string) $answer;
			}
			if ( $chosen ) {
				$lines[] = ( $rowNames[ $rowKey ] ?? $rowKey ) . ': ' . implode( ', ', $chosen );
			}
		}
		return implode( '; ', $lines );
	}

	/**
	 * Stored key => shown name for matrix rows or columns.
	 *
	 * @param mixed $list Rows or columns setting.
	 * @return array<string,string>
	 */
	private static function gridNames( $list ): array {
		$out = array();
		foreach ( is_array( $list ) ? $list : array() as $item ) {
			if ( is_array( $item ) ) {
				$label = (string) ( $item['label'] ?? ( $item['value'] ?? '' ) );
				$key   = (string) ( $item['value'] ?? $label );
			} elseif ( is_scalar( $item ) ) {
				$label = (string) $item;
				$key   = $label;
			} else {
				continue;
			}
			if ( '' !== $key ) {
				$out[ $key ] = wp_strip_all_tags( $label );
			}
		}
		return $out;
	}

	/**
	 * Labels chosen at each level of a chained select.
	 *
	 * `levels` is a list of dropdowns, each with its own options. Without
	 * it, `options` is a tree and each choice's `children` are the next level.
	 *
	 * @param array $value Stored choices, one per level.
	 * @param array $field Field node.
	 * @return string[]
	 */
	private static function chained( array $value, array $field ): array {
		$levels = EntryValues::attr( $field, 'levels' );
		$levels = is_array( $levels ) && array() !== $levels ? array_values( $levels ) : null;
		$nodes  = EntryValues::attr( $field, 'options' );
		$nodes  = is_array( $nodes ) ? $nodes : array();
		$out    = array();

		foreach ( array_values( $value ) as $depth => $chosen ) {
			if ( ! is_scalar( $chosen ) || '' === (string) $chosen ) {
				continue;
			}
			$options = null !== $levels
				? ( isset( $levels[ $depth ]['options'] ) && is_array( $levels[ $depth ]['options'] ) ? $levels[ $depth ]['options'] : array() )
				: $nodes;
			$label = (string) $chosen;
			$next  = array();
			foreach ( $options as $option ) {
				if ( ! is_array( $option ) || (string) ( $option['value'] ?? '' ) !== (string) $chosen ) {
					continue;
				}
				// A later level can repeat a value under different parents.
				if ( null !== $levels && $depth > 0 && isset( $option['parent'] ) && '' !== (string) $option['parent']
					&& (string) $option['parent'] !== (string) ( array_values( $value )[ $depth - 1 ] ?? '' ) ) {
					continue;
				}
				$label = wp_strip_all_tags( (string) ( $option['label'] ?? $chosen ) );
				$next  = is_array( $option['children'] ?? null ) ? $option['children'] : array();
				break;
			}
			$nodes = $next;
			$out[] = $label;
		}
		return $out;
	}

	/**
	 * A date, time or date and time in the field's display format.
	 *
	 * Answers are stored as ISO values (2026-06-15, 09:30, 2026-06-15T14:30).
	 * Anything else is shown as stored.
	 *
	 * @param string $value Stored value.
	 * @param string $type  date, time or datetime.
	 * @param array  $field Field node.
	 * @return string
	 */
	private static function date( string $value, string $type, array $field ): string {
		$value  = trim( $value );
		$format = EntryValues::attr( $field, 'format' );
		$format = is_string( $format ) && '' !== trim( $format ) ? trim( $format ) : self::DATE_FORMATS[ $type ];

		$patterns = array(
			'date'     => '/^\d{4}-\d{2}-\d{2}$/',
			'time'     => '/^\d{1,2}:\d{2}(:\d{2})?$/',
			'datetime' => '/^\d{4}-\d{2}-\d{2}[T ]\d{1,2}:\d{2}(:\d{2})?$/',
		);
		if ( '' === $value || ! preg_match( $patterns[ $type ], $value ) ) {
			return $value;
		}

		$utc  = new \DateTimeZone( 'UTC' );
		$date = 'time' === $type
			? \DateTimeImmutable::createFromFormat( '!Y-m-d H:i', '2000-01-01 ' . substr( $value, 0, 5 ), $utc )
			: new \DateTimeImmutable( str_replace( 'T', ' ', $value ), $utc );
		if ( ! $date ) {
			return $value;
		}
		// wp_date() translates month and day names; the zone is UTC so the
		// answer is shown as typed, never shifted.
		return function_exists( 'wp_date' )
			? (string) wp_date( $format, $date->getTimestamp(), $utc )
			: $date->format( $format );
	}

	/**
	 * A product answer as an order line: "Sticker × 2 ($10.00)".
	 *
	 * @param mixed $value   Stored quantity.
	 * @param array $field   Field node.
	 * @param array $context Display context.
	 * @return string
	 */
	private static function product( $value, array $field, array $context ): string {
		if ( is_array( $value ) ) {
			return FieldMapper::toText( $value );
		}
		$name = (string) EntryValues::attr( $field, 'productName' );
		if ( '' === trim( $name ) ) {
			$name = (string) ( EntryValues::attr( $field, 'label' ) ?? '' );
		}
		$name  = self::shorten( '' !== trim( $name ) ? $name : (string) ( $field['key'] ?? '' ) );
		$qty   = empty( EntryValues::attr( $field, 'allowQuantity' ) ) ? 1 : ( is_numeric( $value ) ? (int) $value : 0 );
		$price = is_numeric( EntryValues::attr( $field, 'price' ) ) ? (float) EntryValues::attr( $field, 'price' ) : 0.0;
		$line  = $name . " \u{00D7} " . $qty;
		return $qty > 0 && $price > 0 ? self::withPrice( $line, $qty * $price, $context ) : $line;
	}

	/**
	 * Text followed by its price in brackets, when it has one.
	 *
	 * @param string $text    Text.
	 * @param float  $amount  Amount.
	 * @param array  $context Display context (currency).
	 */
	private static function withPrice( string $text, float $amount, array $context ): string {
		if ( $amount <= 0 ) {
			return $text;
		}
		return $text . ' (' . self::money( $amount, (string) ( $context['currency'] ?? '' ) ) . ')';
	}

	/**
	 * Money with a currency symbol or code.
	 *
	 * @param float  $amount   Amount.
	 * @param string $currency ISO code.
	 */
	public static function money( float $amount, string $currency ): string {
		$currency = strtoupper( $currency );
		$decimals = '' === $currency ? 2 : \SubtleForms\Payments\Currencies::decimals( $currency );
		$number   = function_exists( 'number_format_i18n' ) ? number_format_i18n( $amount, $decimals ) : number_format( $amount, $decimals );
		if ( '' === $currency ) {
			return $number;
		}
		return isset( self::SYMBOLS[ $currency ] ) ? self::SYMBOLS[ $currency ] . $number : $number . ' ' . $currency;
	}

	// ── Strings ──────────────────────────────────────────────────────────

	/**
	 * Character length, multibyte safe.
	 *
	 * @param string $text Text.
	 */
	private static function length( string $text ): int {
		return function_exists( 'mb_strlen' ) ? mb_strlen( $text, 'UTF-8' ) : strlen( $text );
	}

	/**
	 * The first $length characters, multibyte safe.
	 *
	 * @param string $text   Text.
	 * @param int    $length Characters.
	 */
	private static function slice( string $text, int $length ): string {
		return function_exists( 'mb_substr' ) ? mb_substr( $text, 0, $length, 'UTF-8' ) : substr( $text, 0, $length );
	}
}
