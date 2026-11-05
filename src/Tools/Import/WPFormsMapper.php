<?php
/**
 * WPForms form to SubtleForms schema.
 *
 * Reads the shape WPForms keeps in the post content of a `wpforms` post (and
 * in its export file): `fields` keyed by field id, and `settings` with the
 * notifications and confirmations. Pure: writes nothing.
 *
 * @package SubtleForms\Tools\Import
 * @since   2.8.0
 */

namespace SubtleForms\Tools\Import;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Map one WPForms form, and turn its entries into answers for the result.
 */
final class WPFormsMapper {

	private const SOURCE = 'wpforms';

	/** WPForms condition operators that SubtleForms logic evaluates. */
	private const OPERATORS = array(
		'=='  => 'equals',
		'!='  => 'not_equals',
		'c'   => 'contains',
		'!c'  => 'not_contains',
		'e'   => 'empty',
		'!e'  => 'not_empty',
		'>'   => 'greater_than',
		'<'   => 'less_than',
	);

	/** Field types whose rule value is a choice id. */
	private const CHOICE_TYPES = array( 'select', 'radio', 'checkbox', 'gdpr-checkbox' );

	/** Address parts: WPForms part => SubtleForms part. */
	private const ADDRESS_PARTS = array(
		'address1' => 'street',
		'address2' => 'street2',
		'city'     => 'city',
		'state'    => 'state',
		'postal'   => 'postal',
		'country'  => 'country',
	);

	/** @var ImportNotes */
	private $notes;

	/** @var SchemaBuilder */
	private $build;

	/** @var array<string, string> WPForms field id => SubtleForms key. */
	private $keys = array();

	/** @var array<string, array<string, string>> Field id => choice id => value. */
	private $choiceValues = array();

	/** @var array<string, array> Field id => how to turn an entry answer into a payload value. */
	private $entryMap = array();

	/** @var array Site facts, plus `from_file` for forms read from a file. */
	private $context;

	/** @var array<string, array> Every field by id. */
	private $all = array();

	/**
	 * @param array $context site_title, site_url, admin_email, from_file.
	 */
	public function __construct( array $context = array() ) {
		$this->notes   = new ImportNotes();
		$this->build   = new SchemaBuilder( $this->notes );
		$this->context = $context;
	}

	/**
	 * @param array $form    WPForms form: id, title, fields, settings (or `content`, the stored JSON).
	 * @param array $context Site facts.
	 * @return array{title: string, schema: array, notes: ImportNotes, entry_map: array}
	 */
	public static function map( array $form, array $context = array() ): array {
		return ( new self( $context ) )->run( self::normalize( $form ) );
	}

	/**
	 * One shape for every way a WPForms form arrives: the stored JSON decoded,
	 * the settings and fields at the top.
	 *
	 * @param array $form Form.
	 * @return array
	 */
	public static function normalize( array $form ): array {
		$content = $form['content'] ?? null;
		if ( is_string( $content ) && '' !== $content ) {
			$decoded = json_decode( $content, true );
			if ( is_array( $decoded ) ) {
				$form = array_merge( $decoded, array_filter( $form, static function ( $key ) {
					return 'content' !== $key;
				}, ARRAY_FILTER_USE_KEY ) );
			}
		}
		$fields = $form['fields'] ?? array();
		$out    = array();
		foreach ( is_array( $fields ) ? $fields : array() as $field ) {
			if ( is_array( $field ) && isset( $field['id'] ) && isset( $field['type'] ) ) {
				$out[ (string) $field['id'] ] = $field;
			}
		}
		$form['fields']   = $out;
		$form['settings'] = is_array( $form['settings'] ?? null ) ? $form['settings'] : array();
		if ( '' === trim( (string) ( $form['title'] ?? '' ) ) ) {
			$form['title'] = (string) ( $form['settings']['form_title'] ?? '' );
		}
		return $form;
	}

	/**
	 * @param array $form Normalised form.
	 * @return array{title: string, schema: array, notes: ImportNotes, entry_map: array}
	 */
	private function run( array $form ): array {
		$title    = SchemaBuilder::title( (string) ( $form['title'] ?? '' ) );
		$settings = $form['settings'];
		$this->all = $form['fields'];

		// Fields inside a layout are listed again at the top level; they are placed where the layout is.
		$inLayout = array();
		foreach ( $this->all as $field ) {
			if ( 'layout' === (string) $field['type'] ) {
				foreach ( self::layoutChildren( $field ) as $childId ) {
					$inLayout[ $childId ] = true;
				}
			}
		}

		// Keys and choice values first, so logic and merge tags can point at any field.
		foreach ( $this->all as $id => $field ) {
			$this->reserveKey( (string) $id, $field );
			foreach ( self::choices( $field ) as $choice ) {
				$this->choiceValues[ (string) $id ][ $choice['id'] ] = $choice['value'];
			}
		}

		$items  = array();
		$titles = array();
		foreach ( $this->all as $id => $field ) {
			if ( isset( $inLayout[ (string) $id ] ) ) {
				continue;
			}
			foreach ( $this->field( $field, $titles ) as $mapped ) {
				$items[] = $mapped;
			}
		}
		$fields = $this->build->assemble( $items, $titles );

		$metadata = array();
		$button   = trim( (string) ( $settings['submit_text'] ?? '' ) );
		if ( '' !== $button ) {
			$metadata['submitText'] = SchemaBuilder::cut( $button, SchemaBuilder::MAX_SUBMIT );
		}
		$confirmation = $this->confirmation( $settings );
		if ( $confirmation ) {
			$metadata['confirmation'] = $confirmation;
		}
		if ( ! empty( $settings['honeypot'] ) && '0' !== (string) $settings['honeypot'] ) {
			$this->notes->info( __( 'The WPForms honeypot is not needed: SubtleForms has its own spam protection.', 'subtleforms' ) );
		}

		$actions = $this->emails( $settings );
		$schema  = SchemaBuilder::schema( $title, (string) ( $settings['form_desc'] ?? '' ), $fields, $actions, $metadata );
		return array(
			'title'     => $title,
			'schema'    => $schema,
			'notes'     => $this->notes,
			'entry_map' => $this->entryMap,
		);
	}

	/**
	 * Ids of the fields a layout holds, in reading order.
	 *
	 * @param array $field Layout field.
	 * @return string[]
	 */
	private static function layoutChildren( array $field ): array {
		$ids = array();
		foreach ( (array) ( $field['columns'] ?? array() ) as $column ) {
			$list = is_array( $column ) ? ( $column['fields'] ?? array() ) : array();
			foreach ( (array) $list as $child ) {
				$ids[] = (string) ( is_array( $child ) ? ( $child['id'] ?? '' ) : $child );
			}
		}
		// Older exports keep one flat list of ids beside the columns.
		foreach ( (array) ( $field['fields'] ?? array() ) as $child ) {
			$ids[] = (string) ( is_array( $child ) ? ( $child['id'] ?? '' ) : $child );
		}
		return array_values( array_unique( array_filter( $ids, 'strlen' ) ) );
	}

	/**
	 * @param string $id    Field id.
	 * @param array  $field Field.
	 */
	private function reserveKey( string $id, array $field ): void {
		$type   = strtolower( (string) $field['type'] );
		$target = FieldMap::target( self::SOURCE, $type );
		if ( '' === $target || in_array( $target, array( FieldMap::STEP, FieldMap::SUBMIT, FieldMap::LAYOUT ), true ) ) {
			return;
		}
		$this->keys[ $id ] = $this->build->key( '', self::label( $field, $type ), $id );
	}

	/**
	 * @param array  $field Field.
	 * @param string $type  Type.
	 * @return string
	 */
	public static function label( array $field, string $type = '' ): string {
		$label = SchemaBuilder::plain( (string) ( $field['label'] ?? '' ) );
		if ( '' !== $label ) {
			return $label;
		}
		$defaults = array(
			'name'    => __( 'Name', 'subtleforms' ),
			'address' => __( 'Address', 'subtleforms' ),
			'email'   => __( 'Email', 'subtleforms' ),
			'phone'   => __( 'Phone', 'subtleforms' ),
		);
		return $defaults[ $type ] ?? '';
	}

	/**
	 * @param array $field Field.
	 * @return bool
	 */
	private static function required( array $field ): bool {
		return ! empty( $field['required'] ) && '0' !== (string) $field['required'];
	}

	/**
	 * @param array $field Field.
	 * @return array<int, array{label: string, value: string, id: string, default: bool}>
	 */
	private static function choices( array $field ): array {
		$showValues = ! empty( $field['show_values'] );
		$out        = array();
		foreach ( (array) ( $field['choices'] ?? array() ) as $id => $choice ) {
			if ( ! is_array( $choice ) ) {
				continue;
			}
			$label = SchemaBuilder::plain( (string) ( $choice['label'] ?? '' ) );
			$value = (string) ( $choice['value'] ?? '' );
			$out[] = array(
				'id'      => (string) $id,
				'label'   => $label,
				'value'   => $showValues && '' !== $value ? $value : $label,
				'default' => ! empty( $choice['default'] ),
			);
		}
		return $out;
	}

	/**
	 * One WPForms field as SubtleForms fields (a layout gives several, a page
	 * break a step marker, a skipped field none).
	 *
	 * @param array $field  Field.
	 * @param array $titles Step titles by position, by reference.
	 * @return array<int, array>
	 */
	private function field( array $field, array &$titles ): array {
		$id    = (string) $field['id'];
		$type  = strtolower( (string) $field['type'] );
		$label = self::label( $field, $type );
		$target = FieldMap::target( self::SOURCE, $type );

		if ( '' === $target ) {
			$this->notes->skipped( FieldMap::skippedLine( self::SOURCE, $label, $type ) );
			return array();
		}
		if ( FieldMap::LAYOUT === $target ) {
			return $this->layout( $field, $titles );
		}
		if ( FieldMap::STEP === $target ) {
			return $this->pageBreak( $field, $titles );
		}

		$key      = $this->keys[ $id ] ?? $this->build->key( '', $label, $id );
		$required = self::required( $field );
		$extra    = array(
			'placeholder' => SchemaBuilder::plain( (string) ( $field['placeholder'] ?? '' ) ),
			'description' => SchemaBuilder::plain( (string) ( $field['description'] ?? '' ) ),
		);
		$value    = (string) ( $field['default_value'] ?? '' );
		$entry    = array( 'key' => $key, 'type' => $target );

		switch ( $target ) {
			case 'dropdown':
			case 'radio':
			case 'multiple_choice':
				$choices = self::choices( $field );
				foreach ( $choices as $choice ) {
					$this->choiceValues[ $id ][ $choice['id'] ] = $choice['value'];
				}
				$extra['options'] = SchemaBuilder::options( array_map( static function ( array $c ): array {
					return array( 'label' => $c['label'], 'value' => $c['value'] );
				}, $choices ) );
				$entry['options'] = array();
				foreach ( $choices as $choice ) {
					$entry['options'][ $choice['label'] ] = $choice['value'];
				}
				$ticked = array_values( array_map( static function ( array $c ): string {
					return $c['value'];
				}, array_filter( $choices, static function ( array $c ): bool {
					return $c['default'];
				} ) ) );
				$value  = $ticked ? implode( ', ', 'dropdown' === $target || 'radio' === $target ? array( $ticked[0] ) : $ticked ) : '';
				if ( 'dropdown' === $target && ! empty( $field['multiple'] ) ) {
					$target                 = 'multiple_choice';
					$entry['type']          = 'multiple_choice';
					$extra['allowMultiple'] = true;
					unset( $extra['placeholder'] );
					$this->notes->changed(
						sprintf(
							/* translators: %s: field label */
							__( '\'%s\' allowed several choices in a list, so it is shown as checkboxes.', 'subtleforms' ),
							$label
						)
					);
				}
				if ( 'dropdown' !== $target ) {
					unset( $extra['placeholder'] );
				}
				if ( ! empty( $field['choices_images'] ) || ! empty( $field['choices_icons'] ) ) {
					$this->notes->changed(
						sprintf(
							/* translators: %s: field label */
							__( 'The pictures or icons on the choices of \'%s\' were not copied. The text of each choice was.', 'subtleforms' ),
							$label
						)
					);
				}
				if ( ! empty( $field['dynamic_choices'] ) ) {
					$this->notes->skipped(
						sprintf(
							/* translators: %s: field label */
							__( 'The choices of \'%s\' came from posts or terms. They were not copied; add the choices in the builder.', 'subtleforms' ),
							$label
						)
					);
				}
				break;

			case 'name_group':
				$format = (string) ( $field['format'] ?? 'first-last' );
				if ( 'simple' === $format ) {
					$target = 'text';
					$entry  = array( 'key' => $key, 'type' => 'text' );
					break;
				}
				$extra['fields'] = $this->nameParts( $field, $format );
				unset( $extra['placeholder'] );
				$value = '';
				break;

			case 'address_group':
				$extra['fields'] = $this->addressParts( $field );
				unset( $extra['placeholder'] );
				$value = '';
				if ( 'us' === (string) ( $field['scheme'] ?? '' ) ) {
					$this->notes->info(
						sprintf(
							/* translators: %s: field label */
							__( '\'%s\' used the US address layout. SubtleForms shows its standard address parts.', 'subtleforms' ),
							$label
						)
					);
				}
				break;

			case 'email':
				if ( ! empty( $field['confirmation'] ) ) {
					$this->notes->skipped(
						sprintf(
							/* translators: %s: field label */
							__( 'The confirm email box of \'%s\' was not copied.', 'subtleforms' ),
							$label
						)
					);
				}
				break;

			case 'html':
				$content = 'content' === $type ? (string) ( $field['content'] ?? '' ) : (string) ( $field['code'] ?? '' );
				$built   = $this->build->field( 'html', $key, $label, false );
				$built['content'] = $content;
				return array( $this->withLogic( $built, $field, $label ) );

			case 'section_break':
				$built = $this->build->field(
					'section_break',
					$key,
					$label,
					false,
					array(
						'title'       => $label,
						'description' => SchemaBuilder::plain( (string) ( $field['description'] ?? '' ) ),
					)
				);
				return array( $this->withLogic( $built, $field, $label ) );

			case 'consent':
				$choices = self::choices( $field );
				$text    = $choices ? $choices[0]['label'] : SchemaBuilder::plain( (string) ( $field['description'] ?? '' ) );
				if ( '' !== $text ) {
					$extra['checkboxLabel'] = SchemaBuilder::cut( $text, SchemaBuilder::MAX_LABEL );
				}
				if ( '' === $label ) {
					$label = __( 'Privacy', 'subtleforms' );
				}
				$required = true;
				$value    = '';
				unset( $extra['placeholder'] );
				break;

			case 'hidden':
				$this->entryMap[ $id ] = $entry;
				return array( $this->build->field( 'hidden', $key, '' !== $label ? $label : $key, false, array( 'value' => $this->defaultValue( $value, $label ) ) ) );

			case 'number':
			case 'range_slider':
				foreach ( array( 'min', 'max' ) as $limit ) {
					if ( isset( $field[ $limit ] ) && is_numeric( $field[ $limit ] ) ) {
						$extra[ $limit ] = $field[ $limit ] + 0;
					}
				}
				if ( isset( $field['step'] ) && is_numeric( $field['step'] ) && $field['step'] > 0 ) {
					$extra['step'] = $field['step'] + 0;
				}
				break;

			case 'text':
			case 'textarea':
				if ( ! empty( $field['limit_enabled'] ) && (int) ( $field['limit_count'] ?? 0 ) > 0 ) {
					if ( 'words' === (string) ( $field['limit_mode'] ?? 'characters' ) ) {
						$this->notes->skipped(
							sprintf(
								/* translators: %s: field label */
								__( 'The word limit of \'%s\' was not copied.', 'subtleforms' ),
								$label
							)
						);
					} else {
						$extra['maxLength'] = (int) $field['limit_count'];
					}
				}
				if ( ! empty( $field['input_mask'] ) ) {
					$this->notes->skipped(
						sprintf(
							/* translators: %s: field label */
							__( 'The input mask of \'%s\' was not copied.', 'subtleforms' ),
							$label
						)
					);
				}
				break;

			case 'date':
				$format = (string) ( $field['format'] ?? 'date-time' );
				$target = 'time' === $format ? 'time' : ( 'date' === $format ? 'date' : 'datetime' );
				$entry  = array(
					'key'         => $key,
					'type'        => $target,
					'date_format' => (string) ( $field['date_format'] ?? 'm/d/Y' ),
					'time_format' => (string) ( $field['time_format'] ?? 'g:i A' ),
				);
				$value  = '';
				if ( 'dropdown' === (string) ( $field['date_type'] ?? '' ) ) {
					$this->notes->changed(
						sprintf(
							/* translators: %s: field label */
							__( '\'%s\' used three drop-downs for the date. It now uses one date box.', 'subtleforms' ),
							$label
						)
					);
				}
				break;

			case 'file_upload':
				$types = array();
				foreach ( explode( ',', (string) ( $field['extensions'] ?? '' ) ) as $ext ) {
					$ext = strtolower( trim( $ext, " .\t" ) );
					if ( preg_match( '/^[a-z0-9]+$/', $ext ) ) {
						$types[] = $ext;
					}
				}
				if ( $types ) {
					$extra['allowedExtensions'] = implode( ', ', array_values( array_unique( $types ) ) );
				}
				if ( isset( $field['max_size'] ) && is_numeric( $field['max_size'] ) && $field['max_size'] > 0 ) {
					$extra['maxSize'] = (int) ( $field['max_size'] * 1048576 );
				}
				if ( (int) ( $field['max_file_number'] ?? 1 ) > 1 ) {
					$extra['multiple'] = true;
					$extra['maxFiles'] = min( 20, (int) $field['max_file_number'] );
				}
				$value = '';
				break;

			case 'rating':
				if ( (int) ( $field['scale'] ?? 0 ) > 0 ) {
					$extra['max'] = min( 10, (int) $field['scale'] );
				}
				break;

			case 'net_promoter_score':
				$value = '';
				break;

			case 'rich_text':
				$value = '';
				break;
		}

		if ( '' !== $value && ! in_array( $target, array( 'name_group', 'address_group', 'file_upload' ), true ) ) {
			$extra['defaultValue'] = $this->defaultValue( $value, $label );
		}
		$this->entryMap[ $id ] = $entry;
		return array( $this->withLogic( $this->build->field( $target, $key, $label, $required, $extra ), $field, $label ) );
	}

	/**
	 * A layout: its fields come one under the other.
	 *
	 * @param array $field  Layout.
	 * @param array $titles Step titles, by reference.
	 * @return array<int, array>
	 */
	private function layout( array $field, array &$titles ): array {
		$out = array();
		foreach ( self::layoutChildren( $field ) as $childId ) {
			if ( isset( $this->all[ $childId ] ) ) {
				foreach ( $this->field( $this->all[ $childId ], $titles ) as $mapped ) {
					$out[] = $mapped;
				}
			}
		}
		if ( count( (array) ( $field['columns'] ?? array() ) ) > 1 && $out ) {
			$this->notes->changed( __( 'Fields that sat side by side in columns are now one under the other. Set a field width in the builder to place them side by side again.', 'subtleforms' ) );
		}
		return $out;
	}

	/**
	 * Page breaks. The first (position top) and last (position bottom) ones
	 * only hold the progress bar and button settings; the others start a page.
	 *
	 * @param array $field  Page break.
	 * @param array $titles Step titles by position, by reference.
	 * @return array<int, array>
	 */
	private function pageBreak( array $field, array &$titles ): array {
		$position = (string) ( $field['position'] ?? 'normal' );
		$title    = SchemaBuilder::plain( (string) ( $field['title'] ?? $field['label'] ?? '' ) );
		if ( 'bottom' === $position ) {
			return array();
		}
		if ( 'top' === $position ) {
			if ( '' !== $title ) {
				$titles[0] = $title;
			}
			return array();
		}
		// The title on a break names the page that follows it.
		return array( SchemaBuilder::stepMarker( $title ) );
	}

	/**
	 * @param array  $field  Name field.
	 * @param string $format first-last or first-middle-last.
	 * @return array<string, array>
	 */
	private function nameParts( array $field, string $format ): array {
		$parts = array(
			'first_name'  => array( 'enabled' => true ),
			'middle_name' => array( 'enabled' => 'first-middle-last' === $format ),
			'last_name'   => array( 'enabled' => true ),
			'suffix'      => array( 'enabled' => false ),
		);
		foreach ( array( 'first' => 'first_name', 'middle' => 'middle_name', 'last' => 'last_name' ) as $from => $part ) {
			$placeholder = SchemaBuilder::plain( (string) ( $field[ $from . '_placeholder' ] ?? '' ) );
			if ( '' !== $placeholder ) {
				$parts[ $part ]['placeholder'] = $placeholder;
			}
		}
		return $parts;
	}

	/**
	 * @param array $field Address field.
	 * @return array<string, array>
	 */
	private function addressParts( array $field ): array {
		$parts = array();
		foreach ( self::ADDRESS_PARTS as $from => $part ) {
			$row = array( 'enabled' => empty( $field[ $from . '_hide' ] ) );
			$placeholder = SchemaBuilder::plain( (string) ( $field[ $from . '_placeholder' ] ?? '' ) );
			if ( '' !== $placeholder ) {
				$row['placeholder'] = $placeholder;
			}
			$parts[ $part ] = $row;
		}
		// WPForms always asks for the first line.
		$parts['street']['enabled'] = true;
		return $parts;
	}

	/**
	 * A default value with the smart tags SubtleForms has tokens for.
	 *
	 * @param string $value Value.
	 * @param string $label Label.
	 * @return string
	 */
	private function defaultValue( string $value, string $label ): string {
		if ( false === strpos( $value, '{' ) ) {
			return $value;
		}
		$value = strtr(
			$value,
			array(
				'{user_email}'        => '{user_email}',
				'{user_display_name}' => '{user_name}',
			)
		);
		if ( preg_match( '/\{(?!user_email\}|user_name\})[^{}]+\}/', $value ) ) {
			$this->notes->skipped(
				sprintf(
					/* translators: 1: default value, 2: field label */
					__( 'The default value %1$s of \'%2$s\' was not copied.', 'subtleforms' ),
					$value,
					$label
				)
			);
			return '';
		}
		return $value;
	}

	/**
	 * @param array  $built Mapped field.
	 * @param array  $field WPForms field.
	 * @param string $label Label.
	 * @return array
	 */
	private function withLogic( array $built, array $field, string $label ): array {
		$logic = $this->logic( $field, $label, 'show', 'hide' );
		if ( $logic ) {
			$built['logic'] = $logic;
		}
		return $built;
	}

	/**
	 * WPForms conditional logic as a SubtleForms logic object.
	 *
	 * WPForms keeps groups of rules: the rules in a group must all match, and
	 * any group may match. SubtleForms evaluates one group whose rules must
	 * all match, so several groups, or a rule it cannot evaluate, leave the
	 * field without logic and say so in the report.
	 *
	 * @param array  $source     Field, notification or confirmation with `conditional_logic`.
	 * @param string $label      What it belongs to, for the report.
	 * @param string $keep       Value of `conditional_type` that maps to action show.
	 * @param string $hide       Value of `conditional_type` that maps to action hide.
	 * @return array
	 */
	private function logic( array $source, string $label, string $keep, string $hide ): array {
		if ( empty( $source['conditional_logic'] ) || '0' === (string) $source['conditional_logic'] ) {
			return array();
		}
		$groups = array_values( array_filter( (array) ( $source['conditionals'] ?? array() ), 'is_array' ) );
		if ( ! $groups ) {
			return array();
		}
		$name = '' !== $label ? $label : __( 'a field', 'subtleforms' );
		if ( count( $groups ) > 1 ) {
			$this->notes->skipped(
				sprintf(
					/* translators: %s: field label */
					__( 'The conditional logic of \'%s\' has several groups joined by OR. SubtleForms does not have that, so it was not copied. Set the rules again in the builder.', 'subtleforms' ),
					$name
				)
			);
			return array();
		}
		$type = (string) ( $source['conditional_type'] ?? $keep );
		if ( $type !== $keep && $type !== $hide ) {
			$this->notes->skipped(
				sprintf(
					/* translators: %s: field label */
					__( 'The conditional logic of \'%s\' was not copied: SubtleForms cannot act on it the way it was set.', 'subtleforms' ),
					$name
				)
			);
			return array();
		}
		$rules = array();
		foreach ( $groups[0] as $rule ) {
			$problem = '';
			$field   = is_array( $rule ) ? (string) ( $rule['field'] ?? '' ) : '';
			$op      = is_array( $rule ) ? ( self::OPERATORS[ (string) ( $rule['operator'] ?? '' ) ] ?? '' ) : '';
			if ( '' === $field || ! isset( $this->keys[ $field ] ) ) {
				$problem = 'field';
			} elseif ( '' === $op ) {
				$problem = 'operator';
			}
			if ( '' !== $problem ) {
				$this->notes->skipped(
					sprintf(
						/* translators: %s: field label */
						__( 'The conditional logic of \'%s\' uses a field that was not imported or a comparison SubtleForms does not have (starts with, ends with). It was not copied.', 'subtleforms' ),
						$name
					)
				);
				return array();
			}
			$value = (string) ( $rule['value'] ?? '' );
			if ( isset( $this->choiceValues[ $field ][ $value ] ) ) {
				$value = $this->choiceValues[ $field ][ $value ];
			}
			if ( in_array( $op, array( 'empty', 'not_empty' ), true ) ) {
				$value = '';
			}
			$rules[] = array(
				'field'    => $this->keys[ $field ],
				'operator' => $op,
				'value'    => $value,
			);
		}
		if ( ! $rules ) {
			return array();
		}
		return array(
			'action' => $type === $hide ? 'hide' : 'show',
			'groups' => array(
				array(
					'match' => 'all',
					'rules' => $rules,
				),
			),
		);
	}

	/**
	 * The first confirmation is the default one. Others only apply under
	 * conditions SubtleForms cannot evaluate on a confirmation.
	 *
	 * @param array $settings Form settings.
	 * @return array
	 */
	private function confirmation( array $settings ): array {
		$list = array_values( array_filter( (array) ( $settings['confirmations'] ?? array() ), 'is_array' ) );
		if ( ! $list ) {
			return array();
		}
		if ( count( $list ) > 1 ) {
			$this->notes->skipped(
				sprintf(
					/* translators: %d: number of confirmations */
					_n( '%d more confirmation, shown only under conditions, was not copied.', '%d more confirmations, shown only under conditions, were not copied.', count( $list ) - 1, 'subtleforms' ),
					count( $list ) - 1
				)
			);
		}
		$confirm = $list[0];
		$type    = (string) ( $confirm['type'] ?? 'message' );
		if ( 'redirect' === $type ) {
			$url = trim( $this->tags( (string) ( $confirm['redirect'] ?? '' ), false ) );
			if ( '' !== $url ) {
				return array(
					'type'        => 'redirect',
					'redirectUrl' => $url,
				);
			}
		}
		if ( 'page' === $type && (int) ( $confirm['page'] ?? 0 ) > 0 ) {
			$url = $this->pageUrl( (int) $confirm['page'] );
			if ( '' !== $url ) {
				return array(
					'type'        => 'redirect',
					'redirectUrl' => $url,
				);
			}
			$this->notes->skipped( __( 'The confirmation sent visitors to a page of the other site. Set the address in the form settings.', 'subtleforms' ) );
		}
		$message = trim( $this->tags( (string) ( $confirm['message'] ?? '' ), false ) );
		if ( '' === $message ) {
			return array();
		}
		return array(
			'type'    => 'message',
			'message' => SchemaBuilder::cut( $message, SchemaBuilder::MAX_MESSAGE ),
		);
	}

	/**
	 * The address of a page on this site. Empty when the form came from a
	 * file, because page numbers mean nothing on another site.
	 *
	 * @param int $pageId Page id.
	 * @return string
	 */
	private function pageUrl( int $pageId ): string {
		if ( ! empty( $this->context['from_file'] ) ) {
			return '';
		}
		if ( function_exists( 'get_permalink' ) ) {
			$link = get_permalink( $pageId );
			if ( is_string( $link ) && '' !== $link ) {
				return $link;
			}
		}
		return '/?page_id=' . $pageId;
	}

	/**
	 * @param array $settings Form settings.
	 * @return array
	 */
	private function emails( array $settings ): array {
		$actions = array();
		$index   = 1;
		$allOff  = isset( $settings['notification_enable'] ) && '0' === (string) $settings['notification_enable'];
		foreach ( (array) ( $settings['notifications'] ?? array() ) as $note ) {
			if ( ! is_array( $note ) ) {
				continue;
			}
			$name = SchemaBuilder::plain( (string) ( $note['notification_name'] ?? '' ) );
			$name = '' !== $name ? $name : sprintf( /* translators: %d: number */ __( 'Notification %d', 'subtleforms' ), $index );
			$enabled = ! $allOff;

			$settingsOut = array(
				'to'      => $this->tags( (string) ( $note['email'] ?? '' ), false ),
				'subject' => $this->tags( (string) ( $note['subject'] ?? '' ), false ),
				'message' => $this->tags( (string) ( $note['message'] ?? '' ), false ),
				'format'  => 'html',
			);
			if ( ! empty( $note['conditional_logic'] ) && '0' !== (string) $note['conditional_logic'] ) {
				$logic = $this->logic( $note, $name, 'go', 'stop' );
				if ( $logic && 'show' === $logic['action'] ) {
					$settingsOut['logic'] = $logic;
				} else {
					$enabled = false;
					$this->notes->changed(
						sprintf(
							/* translators: %s: notification name */
							__( 'The email \'%s\' had conditions that could not be copied, so it was imported switched off.', 'subtleforms' ),
							$name
						)
					);
				}
			}

			$headers  = array();
			$from     = trim( $this->tags( (string) ( $note['sender_address'] ?? '' ), true ) );
			$fromName = trim( $this->tags( (string) ( $note['sender_name'] ?? '' ), true ) );
			if ( '' !== $from ) {
				$headers['From'] = '' !== $fromName ? $fromName . ' <' . $from . '>' : $from;
			}
			$rawReply = trim( (string) ( $note['replyto'] ?? '' ) );
			$reply    = trim( $this->tags( $rawReply, true ) );
			if ( '' !== $reply ) {
				$headers['Reply-To'] = array( $this->tags( $rawReply, false ), $rawReply );
			}
			$settingsOut['replyTo'] = SchemaBuilder::replyTo( $headers, $name, $this->notes );
			$settingsOut['headers'] = SchemaBuilder::headers( $headers, $name, $this->notes );
			if ( ! empty( $note['file_upload_attachment_fields'] ) || ! empty( $note['entry_csv_attachment'] ) || ! empty( $note['entry_pdf_attachment'] ) ) {
				$this->notes->skipped(
					sprintf(
						/* translators: %s: notification name */
						__( 'The file attachments of the email \'%s\' were not copied.', 'subtleforms' ),
						$name
					)
				);
			}
			$actions[] = SchemaBuilder::email( $index, $settingsOut, $enabled );
			++$index;
		}
		if ( $actions ) {
			$this->notes->info(
				sprintf(
					/* translators: %d: number of emails */
					_n( '%d email notification was copied.', '%d email notifications were copied.', count( $actions ), 'subtleforms' ),
					count( $actions )
				)
			);
		}
		return $actions;
	}

	/**
	 * WPForms smart tags as SubtleForms merge tags.
	 *
	 * @param string $text   Text.
	 * @param bool   $header Whether the text is an email header.
	 * @return string
	 */
	public function tags( string $text, bool $header ): string {
		$out = preg_replace_callback(
			'/\{([a-z_]+)(?:="([^"]*)")?((?:\s+[a-z_]+="[^"]*")*)\s*\}/i',
			function ( array $m ) use ( $header ): string {
				$name  = strtolower( $m[1] );
				$attrs = array();
				if ( preg_match_all( '/([a-z_]+)="([^"]*)"/i', $m[3], $pairs, PREG_SET_ORDER ) ) {
					foreach ( $pairs as $pair ) {
						$attrs[ strtolower( $pair[1] ) ] = $pair[2];
					}
				}
				if ( in_array( $name, array( 'field_id', 'field_html_id', 'field_value_id' ), true ) ) {
					$id  = (string) ( $m[2] ?? '' );
					$key = $this->keys[ $id ] ?? '';
					if ( '' === $key ) {
						$this->notes->skipped(
							sprintf(
								/* translators: %s: merge tag */
								__( 'The merge tag %s points at a field that was not imported and was left as typed.', 'subtleforms' ),
								$m[0]
							)
						);
						return $m[0];
					}
					return '{field:' . $key . '}';
				}
				switch ( $name ) {
					case 'all_fields':
						return '{all_fields}';
					case 'admin_email':
						return $header ? (string) ( $this->context['admin_email'] ?? '' ) : '{admin_email}';
					case 'form_name':
						return '{form_title}';
					case 'site_name':
						return $header ? (string) ( $this->context['site_title'] ?? '' ) : '{site_name}';
					case 'entry_id':
						return '{entry_id}';
					case 'date':
						return '{date}';
					case 'user_email':
						return '{user_email}';
					case 'user_display_name':
						return '{user_name}';
				}
				$this->notes->skipped(
					sprintf(
						/* translators: %s: merge tag such as {user_ip} */
						__( 'The merge tag %s has no SubtleForms equivalent and was left as typed.', 'subtleforms' ),
						$m[0]
					)
				);
				return $m[0];
			},
			$text
		);
		return is_string( $out ) ? SchemaBuilder::collapseTags( $out ) : $text;
	}

	/**
	 * Turn one stored WPForms entry into answers keyed by SubtleForms field key.
	 *
	 * @param array $entryMap `entry_map` from map().
	 * @param array $values   Field id => stored answer (`value` and parts), as in the entry's `fields`.
	 * @param int   $files    Number of file links, by reference.
	 * @return array<string, mixed>
	 */
	public static function payload( array $entryMap, array $values, int &$files = 0 ): array {
		$payload = array();
		foreach ( $entryMap as $id => $spec ) {
			$row = $values[ $id ] ?? $values[ (string) $id ] ?? null;
			if ( ! is_array( $row ) ) {
				continue;
			}
			$text = isset( $row['value'] ) && is_scalar( $row['value'] ) ? trim( (string) $row['value'] ) : '';
			$type = (string) $spec['type'];
			switch ( $type ) {
				case 'name_group':
					$first = trim( (string) ( $row['first'] ?? '' ) );
					$last  = trim( (string) ( $row['last'] ?? '' ) );
					$mid   = trim( (string) ( $row['middle'] ?? '' ) );
					if ( '' === $first && '' === $last && '' === $mid ) {
						if ( '' === $text ) {
							continue 2;
						}
						$first = $text;
					}
					$payload[ $spec['key'] ] = array_filter(
						array(
							'first_name'  => $first,
							'middle_name' => $mid,
							'last_name'   => $last,
						),
						'strlen'
					);
					break;
				case 'address_group':
					$parts = array_filter(
						array(
							'street_address'   => trim( (string) ( $row['address1'] ?? '' ) ),
							'street_address_2' => trim( (string) ( $row['address2'] ?? '' ) ),
							'city'             => trim( (string) ( $row['city'] ?? '' ) ),
							'state'            => trim( (string) ( $row['state'] ?? '' ) ),
							'postal_code'      => trim( (string) ( $row['postal'] ?? '' ) ),
							'country'          => trim( (string) ( $row['country'] ?? '' ) ),
						),
						'strlen'
					);
					if ( ! $parts && '' !== $text ) {
						$parts = array( 'street_address' => $text );
					}
					if ( $parts ) {
						$payload[ $spec['key'] ] = $parts;
					}
					break;
				case 'multiple_choice':
					if ( '' === $text ) {
						continue 2;
					}
					$picked = array();
					foreach ( preg_split( '/\r\n|\r|\n/', $text ) as $label ) {
						$label = trim( $label );
						if ( '' !== $label ) {
							$picked[] = $spec['options'][ $label ] ?? $label;
						}
					}
					$payload[ $spec['key'] ] = $picked;
					break;
				case 'dropdown':
				case 'radio':
					if ( '' !== $text ) {
						$payload[ $spec['key'] ] = $spec['options'][ $text ] ?? $text;
					}
					break;
				case 'consent':
					$payload[ $spec['key'] ] = '' !== $text;
					break;
				case 'date':
				case 'time':
				case 'datetime':
					$parsed = self::dateValue( $row, $spec );
					if ( '' !== $parsed ) {
						$payload[ $spec['key'] ] = $parsed;
					}
					break;
				case 'file_upload':
					$urls = array();
					foreach ( preg_split( '/\r\n|\r|\n/', $text ) as $url ) {
						$url = trim( $url );
						if ( '' !== $url ) {
							$urls[] = $url;
						}
					}
					if ( $urls ) {
						$files += count( $urls );
						$payload[ $spec['key'] ] = implode( "\n", $urls );
					}
					break;
				default:
					if ( '' !== $text ) {
						$payload[ $spec['key'] ] = $text;
					}
			}
		}
		return $payload;
	}

	/**
	 * A WPForms date and time answer as Y-m-d, H:i or Y-m-d H:i.
	 *
	 * @param array $row  Stored answer.
	 * @param array $spec Entry map row.
	 * @return string
	 */
	private static function dateValue( array $row, array $spec ): string {
		$text = trim( (string) ( $row['value'] ?? '' ) );
		$type = (string) $spec['type'];
		$date = trim( (string) ( $row['date'] ?? '' ) );
		$time = trim( (string) ( $row['time'] ?? '' ) );
		if ( '' === $date && '' === $time ) {
			// The answer as one string: split it on the last space for date and time.
			if ( '' === $text ) {
				return '';
			}
			$date = 'time' === $type ? '' : $text;
			$time = 'time' === $type ? $text : '';
			if ( 'datetime' === $type && preg_match( '/^(.*?)\s+(\d{1,2}:\d{2}.*)$/', $text, $m ) ) {
				$date = $m[1];
				$time = $m[2];
			}
		}
		$day = '';
		if ( '' !== $date ) {
			$parsed = \DateTime::createFromFormat( '!' . (string) $spec['date_format'], $date );
			if ( ! $parsed ) {
				$stamp  = strtotime( $date );
				$parsed = false !== $stamp ? ( new \DateTime( '@' . $stamp ) ) : false;
			}
			$day = $parsed ? $parsed->format( 'Y-m-d' ) : '';
		}
		$clock = '';
		if ( '' !== $time ) {
			$parsed = \DateTime::createFromFormat( '!' . (string) $spec['time_format'], $time );
			if ( ! $parsed ) {
				$stamp  = strtotime( $time );
				$parsed = false !== $stamp ? ( new \DateTime( '@' . $stamp ) ) : false;
			}
			$clock = $parsed ? $parsed->format( 'H:i' ) : '';
		}
		if ( 'time' === $type ) {
			return $clock;
		}
		if ( 'date' === $type ) {
			return $day;
		}
		return '' !== $day ? trim( $day . ' ' . $clock ) : '';
	}
}
