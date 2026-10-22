<?php
/**
 * Shared pieces for building a SubtleForms schema from another plugin's form.
 *
 * Pure functions: no database, no WordPress beyond translation, so the
 * mappers can be tested field by field.
 *
 * @package SubtleForms\Tools\Import
 * @since   2.6.0
 */

namespace SubtleForms\Tools\Import;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use SubtleForms\Support\SchemaValidator;

/**
 * Field, key, step and schema helpers.
 */
final class SchemaBuilder {

	/** Longest values the schema validator accepts. */
	public const MAX_LABEL       = 2000;
	public const MAX_TITLE       = 255;
	public const MAX_PLACEHOLDER = 255;
	public const MAX_DEFAULT     = 500;
	public const MAX_DESCRIPTION = 500;
	public const MAX_MESSAGE     = 5000;
	public const MAX_SUBMIT      = 100;

	/** @var array<string, bool> Keys already used in this form. */
	private $used = array();

	/** @var ImportNotes */
	private $notes;

	/**
	 * @param ImportNotes $notes Report.
	 */
	public function __construct( ImportNotes $notes ) {
		$this->notes = $notes;
	}

	/**
	 * The field key for an imported field: the name the other plugin used when
	 * it is a valid, unused field ID (so integrations keep matching), else one
	 * made from the label.
	 *
	 * @param string $incoming Field name in the other plugin.
	 * @param string $label    Label for the fallback.
	 * @param string $fallback Original field id for the fallback.
	 * @return string
	 */
	public function key( string $incoming, string $label, string $fallback = '' ): string {
		$incoming = trim( $incoming );
		if ( '' !== $incoming
			&& preg_match( '/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/', $incoming )
			&& ! in_array( $incoming, SchemaValidator::RESERVED_KEYS, true )
			&& ! isset( $this->used[ $incoming ] ) ) {
			$this->used[ $incoming ] = true;
			return $incoming;
		}
		$base = trim( strtolower( (string) preg_replace( '/[^a-z0-9]+/i', '_', $label ) ), '_' );
		if ( '' === $base || ! preg_match( '/^[a-z]/', $base ) ) {
			$id   = trim( strtolower( (string) preg_replace( '/[^a-z0-9]+/i', '_', $fallback ) ), '_' );
			$base = '' !== $id ? 'field_' . $id : 'field';
		}
		$base = substr( $base, 0, 40 );
		if ( in_array( $base, SchemaValidator::RESERVED_KEYS, true ) ) {
			$base = 'field_' . $base;
		}
		$key = $base;
		$n   = 2;
		while ( isset( $this->used[ $key ] ) ) {
			$key = substr( $base, 0, 36 ) . '_' . $n;
			++$n;
		}
		$this->used[ $key ] = true;
		return $key;
	}

	/**
	 * A flat field node like the builder saves.
	 *
	 * @param string $type     SubtleForms field type.
	 * @param string $key      Field key.
	 * @param string $label    Label.
	 * @param bool   $required Required.
	 * @param array  $extra    More settings (placeholder, options, ...).
	 * @return array
	 */
	public function field( string $type, string $key, string $label, bool $required = false, array $extra = array() ): array {
		$field = array(
			'id'       => $key,
			'key'      => $key,
			'type'     => $type,
			'label'    => self::cut( self::plain( $label ), self::MAX_LABEL ),
			'required' => $required,
		);
		foreach ( $extra as $name => $value ) {
			if ( null === $value || '' === $value || array() === $value ) {
				continue;
			}
			$field[ $name ] = $value;
		}
		foreach ( array(
			'placeholder'  => self::MAX_PLACEHOLDER,
			'defaultValue' => self::MAX_DEFAULT,
			'description'  => self::MAX_DESCRIPTION,
			'title'        => self::MAX_TITLE,
		) as $name => $max ) {
			if ( isset( $field[ $name ] ) && is_string( $field[ $name ] ) && self::length( $field[ $name ] ) > $max ) {
				$field[ $name ] = self::cut( $field[ $name ], $max );
				$this->notes->changed(
					sprintf(
						/* translators: 1: setting name, 2: field label, 3: number of characters */
						__( 'The %1$s of \'%2$s\' was shortened to %3$d characters.', 'subtleforms' ),
						$name,
						$field['label'],
						$max
					)
				);
			}
		}
		return $field;
	}

	/**
	 * A marker that starts a new step (page) at this point.
	 *
	 * @param string $title Step title.
	 * @param array  $logic Optional logic for the step.
	 * @return array
	 */
	public static function stepMarker( string $title, array $logic = array() ): array {
		return array(
			'__step' => true,
			'title'  => $title,
			'logic'  => $logic,
		);
	}

	/**
	 * Turn a flat list with step markers into root-level steps that hold the
	 * fields, as the builder stores a multi-step form. Fields before the first
	 * marker go into the first step. Without markers the list is returned as is.
	 *
	 * @param array    $items  Fields and step markers.
	 * @param string[] $titles Step titles by position, when the source keeps them apart.
	 * @return array
	 */
	public function assemble( array $items, array $titles = array() ): array {
		$steps   = array();
		$current = null;
		$pending = array();
		$index   = 0;
		$open    = function ( string $title, array $logic ) use ( &$steps, &$current, &$index, $titles ) {
			if ( null !== $current ) {
				$steps[] = $current;
			}
			$fromList = trim( (string) ( $titles[ $index ] ?? '' ) );
			$title    = '' !== $fromList ? $fromList : trim( $title );
			if ( '' === $title ) {
				/* translators: %d: step number */
				$title = sprintf( __( 'Step %d', 'subtleforms' ), $index + 1 );
			}
			$title   = self::cut( self::plain( $title ), self::MAX_TITLE );
			$key     = $this->key( '', 'step_' . ( $index + 1 ) );
			$current = array(
				'id'          => $key,
				'key'         => $key,
				'type'        => 'step',
				'kind'        => 'structure',
				'title'       => $title,
				'label'       => $title,
				'description' => '',
				'children'    => array(),
			);
			if ( $logic ) {
				$current['logic'] = $logic;
			}
			++$index;
		};
		foreach ( $items as $item ) {
			if ( ! empty( $item['__step'] ) ) {
				// Fields before the first break are the first page.
				if ( null === $current && $pending ) {
					$open( '', array() );
					$current['children'] = $pending;
					$pending             = array();
				}
				$open( (string) ( $item['title'] ?? '' ), (array) ( $item['logic'] ?? array() ) );
				continue;
			}
			if ( null === $current ) {
				$pending[] = $item;
			} else {
				$current['children'][] = $item;
			}
		}
		if ( null === $current ) {
			return array_values( $pending );
		}
		$steps[] = $current;
		return $steps;
	}

	/**
	 * A schema ready for FormsRepository::saveSchemaVersion().
	 *
	 * @param string $title       Form title.
	 * @param string $description Description.
	 * @param array  $fields      Fields.
	 * @param array  $actions     Actions.
	 * @param array  $metadata    More metadata (confirmation, submitText, importedFrom ...).
	 * @return array
	 */
	public static function schema( string $title, string $description, array $fields, array $actions = array(), array $metadata = array() ): array {
		$schema = array(
			'schema_version' => 1,
			'metadata'       => array_merge(
				array(
					'name'        => 'form_schema',
					'title'       => self::title( $title ),
					'description' => self::cut( self::plain( $description ), self::MAX_DESCRIPTION ),
					'type'        => 'regular',
				),
				$metadata
			),
			'fields'         => $fields,
			'actions'        => $actions,
		);
		list( $schema ) = \SubtleForms\Support\SchemaRepair::syncType( $schema );
		return $schema;
	}

	/**
	 * Fields that take an answer, at any depth.
	 *
	 * @param array $fields Fields.
	 * @return int
	 */
	public static function countFields( array $fields ): int {
		$n = 0;
		foreach ( $fields as $field ) {
			if ( ! is_array( $field ) ) {
				continue;
			}
			$type = (string) ( $field['type'] ?? '' );
			if ( 'step' !== $type && 'html' !== $type && 'section_break' !== $type ) {
				++$n;
			}
			if ( isset( $field['children'] ) && is_array( $field['children'] ) ) {
				$n += self::countFields( $field['children'] );
			}
		}
		return $n;
	}

	/**
	 * "{field:name} {field:name}" (first and last name parts, which are one
	 * answer here) reads once.
	 *
	 * @param string $text Text with merge tags.
	 * @return string
	 */
	public static function collapseTags( string $text ): string {
		return (string) preg_replace( '/(\{field:([A-Za-z0-9_-]+)\})(?:[ \t]+\{field:\2\})+/', '$1', $text );
	}

	/**
	 * A form title: plain text, at most 200 characters.
	 *
	 * @param string $title Title.
	 * @return string
	 */
	public static function title( string $title ): string {
		$title = self::cut( self::plain( $title ), 200 );
		return '' !== $title ? $title : __( 'Imported form', 'subtleforms' );
	}

	/**
	 * Text without markup or surrounding space.
	 *
	 * @param string $text Text.
	 * @return string
	 */
	public static function plain( string $text ): string {
		$text = (string) preg_replace( '/<[^>]*>/', ' ', $text );
		$text = html_entity_decode( $text, ENT_QUOTES, 'UTF-8' );
		$text = (string) preg_replace( '/\s+/u', ' ', $text );
		// "the <a>terms</a>." must not read "the terms ." once the tags are gone.
		return trim( (string) preg_replace( '/ ([.,;:!?])/u', '$1', $text ) );
	}

	/**
	 * @param string $text Text.
	 * @param int    $max  Characters.
	 * @return string
	 */
	public static function cut( string $text, int $max ): string {
		if ( self::length( $text ) <= $max ) {
			return $text;
		}
		return function_exists( 'mb_substr' ) ? mb_substr( $text, 0, $max ) : substr( $text, 0, $max );
	}

	/**
	 * @param string $text Text.
	 * @return int
	 */
	private static function length( string $text ): int {
		return function_exists( 'mb_strlen' ) ? mb_strlen( $text ) : strlen( $text );
	}

	/**
	 * Choice list in the SubtleForms shape, without empty rows.
	 *
	 * @param array<int, array{label: string, value: string}> $choices Choices.
	 * @return array<int, array{label: string, value: string}>
	 */
	public static function options( array $choices ): array {
		$out = array();
		foreach ( $choices as $choice ) {
			$label = trim( (string) ( $choice['label'] ?? '' ) );
			$value = trim( (string) ( $choice['value'] ?? '' ) );
			if ( '' === $label && '' === $value ) {
				continue;
			}
			$out[] = array(
				'label' => '' !== $label ? $label : $value,
				'value' => '' !== $value ? $value : $label,
			);
		}
		return $out;
	}

	/**
	 * An email action like the builder saves.
	 *
	 * @param int    $index   Position, for the id.
	 * @param array  $settings to, subject, message, format, headers, logic.
	 * @param bool   $enabled Switched on.
	 * @return array
	 */
	public static function email( int $index, array $settings, bool $enabled ): array {
		$settings = array_merge(
			array(
				'to'      => '{admin_email}',
				'subject' => __( 'New entry: {form_title}', 'subtleforms' ),
				'message' => '',
				'format'  => 'html',
			),
			array_filter(
				$settings,
				static function ( $value ) {
					return null !== $value && array() !== $value;
				}
			)
		);
		if ( '' === trim( (string) ( $settings['replyTo'] ?? '' ) ) ) {
			unset( $settings['replyTo'] );
		}
		if ( '' === trim( (string) $settings['to'] ) ) {
			$settings['to'] = '{admin_email}';
		}
		if ( '' === trim( (string) $settings['subject'] ) ) {
			$settings['subject'] = __( 'New entry: {form_title}', 'subtleforms' );
		}
		return array(
			'id'       => 'imported_email_' . $index,
			'type'     => 'email',
			'enabled'  => $enabled,
			'order'    => $index,
			'settings' => $settings,
		);
	}

	/**
	 * Take Reply-To out of the headers as the email's `replyTo` setting.
	 *
	 * SubtleForms fills Reply-To from one answer (`{field:email}`) or uses one
	 * address. Anything else (two addresses, text around a tag, a tag for a
	 * field that was not imported) is reported and left out.
	 *
	 * @param array       $headers     Header name => value or [ value, original ], by reference.
	 * @param string      $sourceLabel Notification name for the report.
	 * @param ImportNotes $notes       Report.
	 * @return string The replyTo setting, or an empty string.
	 */
	public static function replyTo( array &$headers, string $sourceLabel, ImportNotes $notes ): string {
		$value = null;
		foreach ( array_keys( $headers ) as $name ) {
			if ( 0 === strcasecmp( (string) $name, 'Reply-To' ) ) {
				$value = $headers[ $name ];
				unset( $headers[ $name ] );
			}
		}
		if ( null === $value ) {
			return '';
		}
		$original = is_array( $value ) ? (string) ( $value[1] ?? '' ) : (string) $value;
		$value    = trim( (string) preg_replace( '/[\r\n]+/', ' ', is_array( $value ) ? (string) ( $value[0] ?? '' ) : (string) $value ) );
		if ( '' === $value ) {
			return '';
		}
		if ( preg_match( '/^\{field:[A-Za-z0-9_-]+\}$/', $value ) || ( ! preg_match( '/[\s,;<>{}\[\]]/', $value ) && is_email( $value ) ) ) {
			return $value;
		}
		$notes->skipped(
			sprintf(
				/* translators: 1: Reply-To value, 2: notification name */
				__( 'The Reply-To "%1$s" of the email \'%2$s\' was not copied: SubtleForms replies to one address or to one answer.', 'subtleforms' ),
				trim( '' !== $original ? $original : $value ),
				$sourceLabel
			)
		);
		return '';
	}

	/**
	 * Email headers SubtleForms can send as typed: no merge tags left in them,
	 * because headers are sent as written. Returns the kept header lines and
	 * reports the rest.
	 *
	 * @param array<string, string|array> $headers     Header name => value with tags rewritten, or
	 *                                                 [ rewritten value, value as the other plugin had it ].
	 * @param string                      $sourceLabel Notification name for the report.
	 * @param ImportNotes                 $notes       Report.
	 * @return string[]
	 */
	public static function headers( array $headers, string $sourceLabel, ImportNotes $notes ): array {
		$out = array();
		foreach ( $headers as $name => $value ) {
			$original = is_array( $value ) ? (string) ( $value[1] ?? '' ) : (string) $value;
			$value    = is_array( $value ) ? (string) ( $value[0] ?? '' ) : (string) $value;
			$value    = trim( (string) preg_replace( '/[\r\n]+/', ' ', $value ) );
			if ( '' === $value ) {
				continue;
			}
			if ( preg_match( '/\{[^{}]+\}|\[[^\[\]]+\]/', $value ) ) {
				$notes->skipped(
					sprintf(
						/* translators: 1: email header such as Reply-To, 2: its value, 3: notification name */
						__( 'The %1$s address "%2$s" of the email \'%3$s\' was not copied: SubtleForms sends email headers as typed and cannot fill them from an answer yet.', 'subtleforms' ),
						$name,
						trim( $original ),
						$sourceLabel
					)
				);
				continue;
			}
			$out[] = $name . ': ' . $value;
		}
		return $out;
	}
}
