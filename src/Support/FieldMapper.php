<?php
/**
 * Field mapping helpers for integrations.
 *
 * Integrations (email marketing, CRM, PDF) map a form's answers onto a
 * third-party record. Answers are keyed by field key, and some fields store a
 * structured value (a Name field stores first and last name, a checkbox field
 * stores a list). These helpers resolve a mapping source such as `email` or
 * `full_name.first_name` to a plain string, and find sensible defaults when a
 * form has not been mapped by hand.
 *
 * Pure functions only: no WordPress state is read here, so the logic is unit
 * tested in isolation.
 *
 * @package SubtleForms\Support
 * @since   2.1.0
 */

namespace SubtleForms\Support;

/**
 * Resolves mapped answer values.
 */
final class FieldMapper {

	/**
	 * Field types that hold no answer (layout only).
	 */
	private const LAYOUT_TYPES = array(
		'html',
		'heading',
		'divider',
		'section',
		'section_break',
		'step',
		'form_step',
		'page_break',
		'spacer',
		'paragraph',
		'columns',
		'group',
		'row',
		'disclaimer',
		'recaptcha',
		'hcaptcha',
		'turnstile',
		'action_hook',
		'save_resume',
		'payment_summary',
	);

	/**
	 * Composite name field types (value: { first_name, last_name, ... }).
	 */
	private const NAME_TYPES = array( 'name_group', 'name' );

	/**
	 * Values that count as "checked" for a consent or checkbox field.
	 */
	private const TRUTHY = array( '1', 'true', 'yes', 'on', 'checked', 'accepted', 'agree', 'agreed' );

	/**
	 * Flatten a schema into its answer-bearing fields.
	 *
	 * Containers (steps, sections, groups, columns) are walked into but not
	 * returned. A checkbox grid's `columns` holds column labels, not fields, so
	 * only arrays of field arrays are walked.
	 *
	 * @param array $schema Form schema with a `fields` list.
	 * @return array<int,array{key:string,label:string,type:string,field:array}>
	 */
	public static function fields( array $schema ): array {
		$out = array();
		self::walk( isset( $schema['fields'] ) && is_array( $schema['fields'] ) ? $schema['fields'] : array(), $out );
		return $out;
	}

	/**
	 * The name of a field in entries, emails, exports and integrations: its
	 * Admin label when set, else its label, else its key (2.3.2).
	 *
	 * @param array  $node Field node (flat or wrapped in `config`).
	 * @param string $key  Field key.
	 * @return string
	 */
	public static function adminLabel( array $node, string $key = '' ): string {
		$admin = $node['adminLabel'] ?? ( $node['config']['adminLabel'] ?? '' );
		if ( is_string( $admin ) && '' !== trim( $admin ) ) {
			return trim( $admin );
		}
		$label = $node['label'] ?? ( $node['config']['label'] ?? '' );
		if ( is_string( $label ) && '' !== trim( $label ) ) {
			return $label;
		}
		return '' !== $key ? $key : (string) ( $node['key'] ?? ( $node['config']['key'] ?? '' ) );
	}

	/**
	 * Recursive walker for fields().
	 *
	 * @param array $list Field list.
	 * @param array $out  Collected fields, by reference.
	 */
	private static function walk( array $list, array &$out ): void {
		foreach ( $list as $node ) {
			if ( ! is_array( $node ) ) {
				continue;
			}

			$type = (string) ( $node['type'] ?? '' );
			$key  = (string) ( $node['key'] ?? ( $node['config']['key'] ?? ( $node['name'] ?? '' ) ) );

			// A Repeater is one answer (a list of groups) under its own key;
			// its children are answered inside each group (2.3.1).
			if ( Repeater::TYPE === $type ) {
				if ( '' !== $key ) {
					$out[] = array(
						'key'          => $key,
						'label'        => self::adminLabel( $node, $key ),
						'public_label' => (string) ( $node['label'] ?? ( $node['config']['label'] ?? $key ) ),
						'type'         => $type,
						'field'        => $node,
					);
				}
				continue;
			}

			$isLayout = in_array( $type, self::LAYOUT_TYPES, true ) || '_container' === substr( $type, -10 );
			if ( '' !== $key && '' !== $type && ! $isLayout ) {
				$out[] = array(
					'key'          => $key,
					// Entries, emails, exports and integrations use the admin
					// label when one is set (2.3.2).
					'label'        => self::adminLabel( $node, $key ),
					'public_label' => (string) ( $node['label'] ?? ( $node['config']['label'] ?? $key ) ),
					'type'         => $type,
					'field'        => $node,
				);
			}

			foreach ( array( 'fields', 'children' ) as $child ) {
				if ( ! empty( $node[ $child ] ) && is_array( $node[ $child ] ) ) {
					self::walk( $node[ $child ], $out );
				}
			}

			if ( ! empty( $node['columns'] ) && is_array( $node['columns'] ) ) {
				foreach ( $node['columns'] as $column ) {
					if ( is_array( $column ) && isset( $column[0] ) && is_array( $column[0] ) ) {
						self::walk( $column, $out );
					}
				}
			}
		}
	}

	/**
	 * Read the raw value for a mapping source.
	 *
	 * The source is a field key, optionally followed by a dot and a sub-key for
	 * structured values (`name.first_name`, `address.city`). A key that itself
	 * contains a dot is matched before it is split.
	 *
	 * @param array  $payload Submitted answers keyed by field key.
	 * @param string $source  Mapping source.
	 * @return mixed|null Null when the source is empty or missing.
	 */
	public static function raw( array $payload, string $source ) {
		$source = trim( $source );
		if ( '' === $source ) {
			return null;
		}

		if ( array_key_exists( $source, $payload ) ) {
			return $payload[ $source ];
		}

		$parts = explode( '.', $source );
		$value = $payload;
		foreach ( $parts as $part ) {
			if ( ! is_array( $value ) || ! array_key_exists( $part, $value ) ) {
				return null;
			}
			$value = $value[ $part ];
		}

		return $value;
	}

	/**
	 * Resolve a mapping source to a plain string.
	 *
	 * @param array  $payload Submitted answers.
	 * @param string $source  Mapping source.
	 * @return string Empty string when there is no value.
	 */
	public static function value( array $payload, string $source ): string {
		$raw = self::raw( $payload, $source );
		// A drawn signature is an image; integrations get a word, not the
		// image data (PRO2-04).
		if ( EntryValues::isSignatureImage( $raw ) ) {
			return __( 'Signed', 'subtleforms' );
		}
		return self::toText( $raw );
	}

	/**
	 * Turn any answer value into display text.
	 *
	 * Lists join with a comma. A name value joins its parts with a space. Other
	 * structured values (addresses, grids) join their non-empty parts.
	 *
	 * @param mixed $value Answer value.
	 * @return string
	 */
	public static function toText( $value ): string {
		if ( null === $value ) {
			return '';
		}
		if ( is_bool( $value ) ) {
			return $value ? 'Yes' : 'No';
		}
		if ( is_scalar( $value ) ) {
			return trim( (string) $value );
		}
		if ( ! is_array( $value ) ) {
			return '';
		}

		$isName = array_intersect( array_keys( $value ), array( 'first_name', 'last_name', 'middle_name', 'prefix' ) );
		if ( ! empty( $isName ) ) {
			$parts = array();
			foreach ( array( 'prefix', 'first_name', 'middle_name', 'last_name', 'suffix' ) as $part ) {
				if ( isset( $value[ $part ] ) && is_scalar( $value[ $part ] ) && '' !== trim( (string) $value[ $part ] ) ) {
					$parts[] = trim( (string) $value[ $part ] );
				}
			}
			return implode( ' ', $parts );
		}

		$isList = array_keys( $value ) === range( 0, count( $value ) - 1 );
		$parts  = array();
		foreach ( $value as $k => $v ) {
			$text = self::toText( $v );
			if ( '' === $text ) {
				continue;
			}
			$parts[] = ( $isList || ! is_array( $v ) ) ? $text : ( $k . ': ' . $text );
		}

		return implode( ', ', $parts );
	}

	/**
	 * Whether a consent, checkbox or toggle answer counts as accepted.
	 *
	 * @param mixed      $value Answer value.
	 * @param array|null $field Field definition, used for a toggle's on value.
	 * @return bool
	 */
	public static function isChecked( $value, ?array $field = null ): bool {
		if ( is_bool( $value ) ) {
			return $value;
		}
		if ( is_array( $value ) ) {
			foreach ( $value as $item ) {
				if ( self::isChecked( $item, $field ) ) {
					return true;
				}
			}
			return false;
		}
		if ( is_int( $value ) || is_float( $value ) ) {
			return $value > 0;
		}
		if ( ! is_string( $value ) ) {
			return false;
		}

		$value = trim( $value );
		if ( '' === $value ) {
			return false;
		}

		if ( $field ) {
			$on  = $field['onValue'] ?? ( $field['config']['onValue'] ?? null );
			$off = $field['offValue'] ?? ( $field['config']['offValue'] ?? null );
			if ( null !== $on && '' !== (string) $on && $value === (string) $on ) {
				return true;
			}
			if ( null !== $off && '' !== (string) $off && $value === (string) $off ) {
				return false;
			}
		}

		if ( in_array( strtolower( $value ), self::TRUTHY, true ) ) {
			return true;
		}

		// A single checkbox posts its option value; anything other than an
		// explicit "no" or "0" means it was ticked.
		return ! in_array( strtolower( $value ), array( '0', 'false', 'no', 'off' ), true );
	}

	/**
	 * Find the first field of a type.
	 *
	 * @param array        $schema Form schema.
	 * @param string|array $types  Field type or types.
	 * @return array|null Field entry from fields(), or null.
	 */
	public static function firstOfType( array $schema, $types ): ?array {
		$types = (array) $types;
		foreach ( self::fields( $schema ) as $field ) {
			if ( in_array( $field['type'], $types, true ) ) {
				return $field;
			}
		}
		return null;
	}

	/**
	 * Default mapping for the identity fields when the form has not been
	 * mapped by hand: the first email field, and first and last name from a
	 * Name field or from fields keyed first_name / last_name.
	 *
	 * @param array $schema Form schema.
	 * @return array{email:string,first_name:string,last_name:string}
	 */
	public static function defaults( array $schema ): array {
		$map = array(
			'email'      => '',
			'first_name' => '',
			'last_name'  => '',
		);

		$fields = self::fields( $schema );

		foreach ( $fields as $field ) {
			if ( '' === $map['email'] && 'email' === $field['type'] ) {
				$map['email'] = $field['key'];
			}
			if ( in_array( $field['type'], self::NAME_TYPES, true ) && '' === $map['first_name'] ) {
				$map['first_name'] = $field['key'] . '.first_name';
				$map['last_name']  = $field['key'] . '.last_name';
			}
		}

		foreach ( $fields as $field ) {
			$key = strtolower( $field['key'] );
			if ( '' === $map['email'] && preg_match( '/^(e-?mail|email_address|your_email)$/', $key ) ) {
				$map['email'] = $field['key'];
			}
			if ( '' === $map['first_name'] && preg_match( '/^(first_?name|fname|given_name)$/', $key ) ) {
				$map['first_name'] = $field['key'];
			}
			if ( '' === $map['last_name'] && preg_match( '/^(last_?name|lname|surname|family_name)$/', $key ) ) {
				$map['last_name'] = $field['key'];
			}
		}

		// A single "Name" / "Full name" text field: integrations split it into
		// first and last name.
		if ( '' === $map['first_name'] && '' === $map['last_name'] ) {
			foreach ( $fields as $field ) {
				if ( preg_match( '/^(name|full_?name|your_?name)$/', strtolower( $field['key'] ) ) && in_array( $field['type'], array( 'text', 'name' ), true ) ) {
					$map['first_name'] = $field['key'];
					break;
				}
			}
		}

		return $map;
	}

	/**
	 * Split a full name into first and last name.
	 *
	 * Used when a form only has a single "Full name" text field mapped to
	 * first name and nothing mapped to last name.
	 *
	 * @param string $full Full name.
	 * @return array{0:string,1:string}
	 */
	public static function splitName( string $full ): array {
		$full = trim( preg_replace( '/\s+/', ' ', $full ) );
		if ( '' === $full ) {
			return array( '', '' );
		}
		$pos = strpos( $full, ' ' );
		if ( false === $pos ) {
			return array( $full, '' );
		}
		return array( substr( $full, 0, $pos ), substr( $full, $pos + 1 ) );
	}

	/**
	 * Apply a list of `{ field, target }` rows to a payload.
	 *
	 * Rows with an empty source, empty target or empty value are skipped, so a
	 * blank answer never overwrites data already held by the provider.
	 *
	 * @param array  $payload   Submitted answers.
	 * @param array  $rows      Mapping rows.
	 * @param string $targetKey Name of the target key in each row.
	 * @return array<string,string> target => value
	 */
	public static function mapRows( array $payload, array $rows, string $targetKey = 'target' ): array {
		$out = array();
		foreach ( $rows as $row ) {
			if ( ! is_array( $row ) ) {
				continue;
			}
			$target = trim( (string) ( $row[ $targetKey ] ?? '' ) );
			$source = trim( (string) ( $row['field'] ?? '' ) );
			if ( '' === $target || '' === $source ) {
				continue;
			}
			$value = self::value( $payload, $source );
			if ( '' === $value ) {
				continue;
			}
			$out[ $target ] = $value;
		}
		return $out;
	}

	/**
	 * Replace choice values with their option labels ("vip" becomes "VIP
	 * seat"). Values without a matching option are kept as they are.
	 *
	 * @param mixed $value Answer value.
	 * @param array $field Field definition.
	 * @return mixed
	 */
	public static function optionLabels( $value, array $field ) {
		$options = $field['options'] ?? ( $field['config']['options'] ?? null );
		if ( ! is_array( $options ) || empty( $options ) ) {
			return $value;
		}

		$labels = array();
		foreach ( $options as $option ) {
			if ( is_array( $option ) && isset( $option['value'] ) && is_scalar( $option['value'] ) ) {
				$labels[ (string) $option['value'] ] = (string) ( $option['label'] ?? $option['value'] );
			}
		}
		if ( empty( $labels ) ) {
			return $value;
		}

		if ( is_scalar( $value ) ) {
			return $labels[ (string) $value ] ?? $value;
		}
		if ( is_array( $value ) && array_keys( $value ) === range( 0, count( $value ) - 1 ) ) {
			return array_map(
				static function ( $item ) use ( $labels ) {
					return is_scalar( $item ) ? ( $labels[ (string) $item ] ?? $item ) : $item;
				},
				$value
			);
		}
		return $value;
	}

	/**
	 * Label/value pairs for every answered field, in form order.
	 *
	 * Used for CRM notes and the entry PDF. Answers that are not in the schema
	 * (for example from an older form version) are appended by key.
	 *
	 * @param array $schema  Form schema.
	 * @param array $payload Submitted answers.
	 * @param bool  $skipEmpty Leave out unanswered fields.
	 * @return array<int,array{key:string,label:string,value:string}>
	 */
	public static function answers( array $schema, array $payload, bool $skipEmpty = true ): array {
		$rows = array();
		$seen = array();

		foreach ( self::fields( $schema ) as $field ) {
			$key = $field['key'];
			if ( isset( $seen[ $key ] ) || ! array_key_exists( $key, $payload ) ) {
				continue;
			}
			$seen[ $key ] = true;
			if ( Repeater::TYPE === $field['type'] ) {
				// One numbered line per group; `groups` carries the cells for
				// renderers that draw a table (the Pro PDF, 2.3.1).
				$text = Repeater::toText( $payload[ $key ], $field['field'] );
				if ( $skipEmpty && '' === $text ) {
					continue;
				}
				$rows[] = array(
					'key'    => $key,
					'label'  => '' !== $field['label'] ? $field['label'] : $key,
					'value'  => $text,
					'groups' => Repeater::rows( $payload[ $key ], $field['field'] ),
				);
				continue;
			}
			$text         = 'consent' === $field['type']
				? ( self::isChecked( $payload[ $key ], $field['field'] ) ? __( 'Yes', 'subtleforms' ) : __( 'No', 'subtleforms' ) )
				: self::toText( self::optionLabels( $payload[ $key ], $field['field'] ) );
			if ( $skipEmpty && '' === $text ) {
				continue;
			}
			$rows[] = array(
				'key'   => $key,
				'label' => '' !== $field['label'] ? $field['label'] : $key,
				'value' => $text,
			);
		}

		foreach ( $payload as $key => $value ) {
			$key = (string) $key;
			if ( isset( $seen[ $key ] ) || '' === $key || '_' === $key[0] || in_array( $key, array( 'website_url', 'form_rendered_at' ), true ) ) {
				continue;
			}
			$text = self::toText( $value );
			if ( $skipEmpty && '' === $text ) {
				continue;
			}
			$rows[] = array(
				'key'   => $key,
				'label' => ucwords( str_replace( array( '_', '-' ), ' ', $key ) ),
				'value' => $text,
			);
		}

		return $rows;
	}
}
