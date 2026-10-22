<?php
/**
 * Fluent Forms form to SubtleForms schema.
 *
 * Reads the database shape (form_fields JSON, form settings and notification
 * meta rows) and the export file shape (the same with `metas`). Pure: writes
 * nothing.
 *
 * @package SubtleForms\Tools\Import
 * @since   2.6.0
 */

namespace SubtleForms\Tools\Import;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Map one Fluent Forms form.
 */
final class FluentMapper {

	private const SOURCE = 'fluent';

	/** Fluent condition operators that SubtleForms logic has. */
	private const OPERATORS = array(
		'='             => 'equals',
		'=='            => 'equals',
		'!='            => 'not_equals',
		'>'             => 'greater_than',
		'<'             => 'less_than',
		'contains'      => 'contains',
		'doNotContains' => 'not_contains',
		'startsWith'    => 'starts_with',
		'endsWith'      => 'ends_with',
	);

	/** Name parts: Fluent sub-field => SubtleForms part. */
	private const NAME_PARTS = array(
		'first_name'  => 'first_name',
		'middle_name' => 'middle_name',
		'last_name'   => 'last_name',
	);

	/** Address parts: Fluent sub-field => SubtleForms part. */
	private const ADDRESS_PARTS = array(
		'address_line_1' => 'street',
		'address_line_2' => 'street2',
		'city'           => 'city',
		'state'          => 'state',
		'zip'            => 'postal',
		'country'        => 'country',
	);

	/** @var ImportNotes */
	private $notes;

	/** @var SchemaBuilder */
	private $build;

	/** @var array<string, string> Fluent field name => SubtleForms key. */
	private $keys = array();

	/** @var array Site facts. */
	private $context;

	/**
	 * @param array $context site_title, site_url, admin_email.
	 */
	public function __construct( array $context = array() ) {
		$this->notes   = new ImportNotes();
		$this->build   = new SchemaBuilder( $this->notes );
		$this->context = $context;
	}

	/**
	 * @param array $form    Fluent form: title, form_fields, formSettings, notifications (or metas).
	 * @param array $context Site facts.
	 * @return array{title: string, schema: array, notes: ImportNotes}
	 */
	public static function map( array $form, array $context = array() ): array {
		return ( new self( $context ) )->run( self::normalize( $form ) );
	}

	/**
	 * One shape for every way a Fluent form arrives: form_fields decoded,
	 * `metas` rows (export files) folded into formSettings and notifications.
	 *
	 * @param array $form Fluent form.
	 * @return array
	 */
	public static function normalize( array $form ): array {
		$structure = $form['form_fields'] ?? array();
		if ( is_string( $structure ) ) {
			$decoded   = json_decode( $structure, true );
			$structure = is_array( $decoded ) ? $decoded : array();
		}
		if ( is_array( $structure ) && array_is_list( $structure ) ) {
			$structure = array( 'fields' => $structure );
		}
		$form['form_fields'] = is_array( $structure ) ? $structure : array();

		$notifications = array();
		foreach ( (array) ( $form['metas'] ?? array() ) as $row ) {
			if ( ! is_array( $row ) ) {
				continue;
			}
			$key   = (string) ( $row['meta_key'] ?? $row['key'] ?? '' );
			$value = self::decode( $row['value'] ?? $row['meta_value'] ?? null );
			if ( 'notifications' === $key && is_array( $value ) ) {
				foreach ( self::notificationList( $value ) as $note ) {
					$notifications[] = $note;
				}
			} elseif ( 'formSettings' === $key && is_array( $value ) && ! isset( $form['formSettings'] ) ) {
				$form['formSettings'] = $value;
			}
		}
		$own = self::decode( $form['notifications'] ?? null );
		if ( ! $own && is_array( $form['formSettings']['notifications'] ?? null ) ) {
			$own = $form['formSettings']['notifications'];
		}
		if ( is_array( $own ) ) {
			foreach ( self::notificationList( $own ) as $note ) {
				$notifications[] = $note;
			}
		}
		$form['notifications'] = $notifications;
		$form['formSettings']  = is_array( $form['formSettings'] ?? null ) ? $form['formSettings'] : array();
		return $form;
	}

	/**
	 * @param mixed $value JSON string or value.
	 * @return mixed
	 */
	private static function decode( $value ) {
		if ( is_string( $value ) ) {
			$decoded = json_decode( $value, true );
			return null === $decoded ? $value : $decoded;
		}
		return $value;
	}

	/**
	 * One notification, a list, or a map of notifications.
	 *
	 * @param array $value Raw value.
	 * @return array<int, array>
	 */
	private static function notificationList( array $value ): array {
		if ( ! $value ) {
			return array();
		}
		if ( isset( $value['sendTo'] ) || isset( $value['subject'] ) || isset( $value['message'] ) || isset( $value['email'] ) ) {
			return array( $value );
		}
		return array_values( array_filter( $value, 'is_array' ) );
	}

	/**
	 * @param array $form Normalised Fluent form.
	 * @return array{title: string, schema: array, notes: ImportNotes}
	 */
	private function run( array $form ): array {
		$title     = SchemaBuilder::title( (string) ( $form['title'] ?? '' ) );
		$structure = $form['form_fields'];
		$rawFields = array_values( array_filter( (array) ( $structure['fields'] ?? array() ), 'is_array' ) );

		// Keys first, so logic and merge tags can point at any field.
		$this->reserveKeys( $rawFields );

		$items = array();
		foreach ( $rawFields as $field ) {
			foreach ( $this->field( $field ) as $mapped ) {
				$items[] = $mapped;
			}
		}
		$titles = (array) ( $structure['stepsWrapper']['stepStart']['settings']['step_titles'] ?? array() );
		$fields = $this->build->assemble( $items, array_map( 'strval', $titles ) );

		$metadata = array();
		$button   = trim( (string) ( $structure['submitButton']['settings']['button_ui']['text'] ?? '' ) );
		if ( '' !== $button ) {
			$metadata['submitText'] = SchemaBuilder::cut( $button, SchemaBuilder::MAX_SUBMIT );
		}
		$confirmation = $this->confirmation( $form['formSettings'] );
		if ( $confirmation ) {
			$metadata['confirmation'] = $confirmation;
		}
		$restrictions = $this->restrictions( (array) ( $form['formSettings']['restrictions'] ?? array() ) );
		if ( $restrictions ) {
			$metadata['restrictions'] = $restrictions;
		}

		$actions = $this->emails( $form['notifications'] );
		$schema  = SchemaBuilder::schema( $title, '', $fields, $actions, $metadata );
		return array(
			'title'  => $title,
			'schema' => $schema,
			'notes'  => $this->notes,
		);
	}

	/**
	 * @param array $fields Fluent fields.
	 */
	private function reserveKeys( array $fields ): void {
		foreach ( $fields as $field ) {
			if ( ! is_array( $field ) ) {
				continue;
			}
			$element = self::element( $field );
			if ( 'container' === $element ) {
				$this->reserveKeys( self::columnFields( $field ) );
				continue;
			}
			$target = FieldMap::target( self::SOURCE, $element );
			if ( '' === $target || FieldMap::STEP === $target || FieldMap::SUBMIT === $target ) {
				continue;
			}
			$name = self::name( $field );
			if ( '' !== $name && ! isset( $this->keys[ $name ] ) ) {
				$this->keys[ $name ] = $this->build->key( $name, self::label( $field, $element ), $name );
			}
		}
	}

	/**
	 * @param array $field Fluent field.
	 * @return string
	 */
	private static function element( array $field ): string {
		return strtolower( (string) ( $field['element'] ?? $field['type'] ?? '' ) );
	}

	/**
	 * @param array $field Fluent field.
	 * @return string
	 */
	private static function name( array $field ): string {
		return (string) ( $field['attributes']['name'] ?? $field['settings']['name'] ?? '' );
	}

	/**
	 * @param array  $field   Fluent field.
	 * @param string $element Element.
	 * @return string
	 */
	public static function label( array $field, string $element = '' ): string {
		$settings = is_array( $field['settings'] ?? null ) ? $field['settings'] : array();
		foreach ( array( $settings['label'] ?? '', $settings['admin_field_label'] ?? '', $field['admin_field_label'] ?? '', $field['label'] ?? '' ) as $candidate ) {
			$candidate = SchemaBuilder::plain( (string) $candidate );
			if ( '' !== $candidate ) {
				return $candidate;
			}
		}
		if ( 'input_name' === $element ) {
			return __( 'Name', 'subtleforms' );
		}
		if ( 'address' === $element ) {
			return __( 'Address', 'subtleforms' );
		}
		return '';
	}

	/**
	 * @param array $field Fluent field.
	 * @return bool
	 */
	private static function required( array $field ): bool {
		$settings = is_array( $field['settings'] ?? null ) ? $field['settings'] : array();
		$rule     = $settings['validation_rules']['required'] ?? null;
		if ( is_array( $rule ) ) {
			return ! empty( $rule['value'] );
		}
		return ! empty( $field['required'] ) || ! empty( $settings['required'] );
	}

	/**
	 * Fields inside a container's columns, in reading order.
	 *
	 * @param array $field Container.
	 * @return array<int, array>
	 */
	private static function columnFields( array $field ): array {
		$out     = array();
		$columns = $field['columns'] ?? $field['settings']['columns'] ?? array();
		foreach ( (array) $columns as $column ) {
			if ( ! is_array( $column ) ) {
				continue;
			}
			$inner = isset( $column['fields'] ) && is_array( $column['fields'] ) ? $column['fields'] : array();
			foreach ( $inner as $child ) {
				if ( is_array( $child ) && ( isset( $child['element'] ) || isset( $child['type'] ) ) ) {
					$out[] = $child;
				}
			}
		}
		return $out;
	}

	/**
	 * One Fluent field as SubtleForms fields (a container gives several, a
	 * step a step marker, a skipped field none).
	 *
	 * @param array $field Fluent field.
	 * @return array<int, array>
	 */
	private function field( array $field ): array {
		$element  = self::element( $field );
		$settings = is_array( $field['settings'] ?? null ) ? $field['settings'] : array();
		$attrs    = is_array( $field['attributes'] ?? null ) ? $field['attributes'] : array();
		$label    = self::label( $field, $element );

		if ( 'container' === $element ) {
			$out = array();
			foreach ( self::columnFields( $field ) as $child ) {
				foreach ( $this->field( $child ) as $mapped ) {
					$out[] = $mapped;
				}
			}
			if ( count( (array) ( $field['columns'] ?? array() ) ) > 1 && $out ) {
				$this->notes->changed( __( 'Fields that sat side by side in columns are now one under the other. Set a field width in the builder to place them side by side again.', 'subtleforms' ) );
			}
			return $out;
		}

		$target = FieldMap::target( self::SOURCE, $element );
		if ( FieldMap::SUBMIT === $target ) {
			return array();
		}
		if ( '' === $target ) {
			$this->notes->skipped( FieldMap::skippedLine( self::SOURCE, $label, $element ) );
			return array();
		}
		if ( FieldMap::STEP === $target ) {
			return array( SchemaBuilder::stepMarker( '' ) );
		}

		$name     = self::name( $field );
		$key      = '' !== $name && isset( $this->keys[ $name ] ) ? $this->keys[ $name ] : $this->build->key( '', $label, $element );
		$required = self::required( $field );
		$extra    = array(
			'placeholder' => SchemaBuilder::plain( (string) ( $attrs['placeholder'] ?? $settings['placeholder'] ?? '' ) ),
			'description' => SchemaBuilder::plain( (string) ( $settings['help_message'] ?? '' ) ),
		);
		$value    = $attrs['value'] ?? '';

		switch ( $target ) {
			case 'dropdown':
			case 'radio':
			case 'multiple_choice':
				$extra['options'] = self::choices( $field );
				if ( is_array( $value ) ) {
					$value = implode( ', ', array_map( 'strval', $value ) );
				}
				if ( 'multi_select' === $element || ( 'select' === $element && ! empty( $attrs['multiple'] ) ) ) {
					$target                 = 'multiple_choice';
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
				break;

			case 'name_group':
			case 'address_group':
				$extra['fields'] = $this->parts( $field, $target );
				unset( $extra['placeholder'] );
				$required = $required || $this->anyPartRequired( $field );
				$value    = '';
				break;

			case 'html':
				$built            = $this->build->field( 'html', $key, $label, false );
				$built['content'] = (string) ( $settings['html_codes'] ?? $settings['content'] ?? '' );
				return array( $this->withLogic( $built, $field, $label ) );

			case 'section_break':
				$built = $this->build->field(
					'section_break',
					$key,
					$label,
					false,
					array(
						'title'       => $label,
						'description' => SchemaBuilder::plain( (string) ( $settings['description'] ?? '' ) ),
					)
				);
				return array( $this->withLogic( $built, $field, $label ) );

			case 'consent':
				$html = (string) ( $settings['tnc_html'] ?? '' );
				$text = SchemaBuilder::plain( $html );
				if ( '' !== $text ) {
					$extra['checkboxLabel'] = SchemaBuilder::cut( $text, SchemaBuilder::MAX_LABEL );
				}
				if ( preg_match( '#<a\s[^>]*href=["\']([^"\']+)["\']#i', $html, $link ) ) {
					$extra['privacyPolicyUrl'] = $link[1];
				}
				if ( '' === $label ) {
					$label = 'gdpr_agreement' === $element ? __( 'Privacy', 'subtleforms' ) : __( 'Terms and conditions', 'subtleforms' );
				}
				// Fluent always requires these boxes to be ticked.
				$required = true;
				$value    = '';
				unset( $extra['placeholder'] );
				break;

			case 'hidden':
				return array( $this->build->field( 'hidden', $key, '' !== $label ? $label : $name, false, array( 'value' => $this->defaultValue( (string) ( $value ?: ( $settings['value'] ?? '' ) ), $label ) ) ) );

			case 'number':
			case 'range_slider':
				foreach ( array( 'min', 'max' ) as $limit ) {
					$rule = $settings['validation_rules'][ $limit ]['value'] ?? $attrs[ $limit ] ?? null;
					if ( is_numeric( $rule ) ) {
						$extra[ $limit ] = $rule + 0;
					}
				}
				$step = $settings['number_step'] ?? $attrs['step'] ?? null;
				if ( is_numeric( $step ) ) {
					$extra['step'] = $step + 0;
				}
				break;

			case 'text':
			case 'textarea':
				if ( isset( $attrs['maxlength'] ) && (int) $attrs['maxlength'] > 0 ) {
					$extra['maxLength'] = (int) $attrs['maxlength'];
				}
				if ( 'textarea' === $target && isset( $attrs['rows'] ) && (int) $attrs['rows'] > 0 ) {
					$extra['rows'] = (int) $attrs['rows'];
				}
				break;

			case 'file_upload':
			case 'image_upload':
				$rules = (array) ( $settings['validation_rules'] ?? array() );
				$size  = $rules['max_file_size']['value'] ?? null;
				if ( is_numeric( $size ) && $size > 0 ) {
					$extra['maxSize'] = (int) $size;
				}
				$count = $rules['max_file_count']['value'] ?? null;
				if ( is_numeric( $count ) && (int) $count > 1 ) {
					$extra['multiple'] = true;
					$extra['maxFiles'] = min( 20, (int) $count );
				}
				$types = array();
				foreach ( (array) ( $rules['allowed_file_types']['value'] ?? $rules['allowed_image_types']['value'] ?? array() ) as $group ) {
					foreach ( explode( '|', (string) $group ) as $ext ) {
						$ext = strtolower( trim( $ext, " .\t" ) );
						if ( preg_match( '/^[a-z0-9]+$/', $ext ) ) {
							$types[] = $ext;
						}
					}
				}
				if ( $types ) {
					$extra['allowedExtensions'] = implode( ', ', array_values( array_unique( $types ) ) );
				}
				$value = '';
				break;
		}

		if ( is_string( $value ) && '' !== $value ) {
			$extra['defaultValue'] = $this->defaultValue( $value, $label );
		}
		return array( $this->withLogic( $this->build->field( $target, $key, $label, $required, $extra ), $field, $label ) );
	}

	/**
	 * A default value with the Fluent smart codes SubtleForms has turned into
	 * its own tokens. Others are dropped and reported.
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
				'{user.user_email}'   => '{user_email}',
				'{user.display_name}' => '{user_name}',
				'{date.Y-m-d}'        => '{date}',
			)
		);
		$value = (string) preg_replace( '/\{get\.([A-Za-z0-9_-]+)\}/', '{get:$1}', $value );
		if ( preg_match( '/\{(?!user_email\}|user_name\}|date\}|get:)[^{}]+\}/', $value ) ) {
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
	 * @param array $field Fluent field.
	 * @return array<int, array{label: string, value: string}>
	 */
	public static function choices( array $field ): array {
		$settings = is_array( $field['settings'] ?? null ) ? $field['settings'] : array();
		$raw      = $settings['advanced_options'] ?? $field['options'] ?? $settings['options'] ?? array();
		$choices  = array();
		foreach ( (array) $raw as $value => $choice ) {
			if ( is_array( $choice ) ) {
				$choices[] = array(
					'label' => SchemaBuilder::plain( (string) ( $choice['label'] ?? $choice['text'] ?? '' ) ),
					'value' => (string) ( $choice['value'] ?? $choice['label'] ?? '' ),
				);
			} elseif ( is_scalar( $choice ) ) {
				// Older forms: value => label.
				$choices[] = array(
					'label' => (string) $choice,
					'value' => is_string( $value ) ? $value : (string) $choice,
				);
			}
		}
		return SchemaBuilder::options( $choices );
	}

	/**
	 * Name or Address parts.
	 *
	 * @param array  $field  Fluent field.
	 * @param string $target name_group or address_group.
	 * @return array<string, array>
	 */
	private function parts( array $field, string $target ): array {
		$map   = 'name_group' === $target ? self::NAME_PARTS : self::ADDRESS_PARTS;
		$parts = array();
		foreach ( 'name_group' === $target ? array( 'first_name', 'middle_name', 'last_name', 'suffix' ) : array_values( self::ADDRESS_PARTS ) as $part ) {
			$parts[ $part ] = array( 'enabled' => false );
		}
		$subs = is_array( $field['fields'] ?? null ) ? $field['fields'] : array();
		if ( ! $subs ) {
			$defaults = 'name_group' === $target ? array( 'first_name', 'last_name' ) : array_values( self::ADDRESS_PARTS );
			foreach ( $defaults as $part ) {
				$parts[ $part ]['enabled'] = true;
			}
			return $parts;
		}
		foreach ( $map as $from => $part ) {
			$sub = $subs[ $from ] ?? null;
			if ( ! is_array( $sub ) ) {
				continue;
			}
			$visible = $sub['settings']['visible'] ?? true;
			$row     = array( 'enabled' => (bool) $visible && 'no' !== $visible );
			$text    = SchemaBuilder::plain( (string) ( $sub['settings']['label'] ?? '' ) );
			if ( '' !== $text ) {
				$row['label'] = $text;
			}
			$placeholder = SchemaBuilder::plain( (string) ( $sub['attributes']['placeholder'] ?? $sub['settings']['placeholder'] ?? '' ) );
			if ( '' !== $placeholder ) {
				$row['placeholder'] = $placeholder;
			}
			$parts[ $part ] = $row;
		}
		return $parts;
	}

	/**
	 * @param array $field Name or address field.
	 * @return bool
	 */
	private function anyPartRequired( array $field ): bool {
		foreach ( (array) ( $field['fields'] ?? array() ) as $sub ) {
			if ( is_array( $sub ) && ( $sub['settings']['visible'] ?? true ) && ! empty( $sub['settings']['validation_rules']['required']['value'] ) ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * @param array  $built Mapped field.
	 * @param array  $field Fluent field.
	 * @param string $label Label.
	 * @return array
	 */
	private function withLogic( array $built, array $field, string $label ): array {
		$logic = $this->logic( (array) ( $field['settings']['conditional_logics'] ?? array() ), $label );
		if ( $logic ) {
			$built['logic'] = $logic;
		}
		return $built;
	}

	/**
	 * Fluent conditional logic as a SubtleForms logic object.
	 *
	 * @param array  $logic `conditional_logics` or `conditionals`.
	 * @param string $label What it belongs to, for the report.
	 * @return array
	 */
	private function logic( array $logic, string $label ): array {
		$on = $logic['status'] ?? false;
		if ( ! $on || 'no' === $on || 'false' === $on || empty( $logic['conditions'] ) ) {
			return array();
		}
		$rules   = array();
		$skipped = 0;
		foreach ( (array) $logic['conditions'] as $condition ) {
			if ( ! is_array( $condition ) || '' === (string) ( $condition['field'] ?? '' ) ) {
				continue;
			}
			$source = (string) $condition['field'];
			$key    = $this->keys[ $source ] ?? '';
			$op     = self::OPERATORS[ (string) ( $condition['operator'] ?? '=' ) ] ?? '';
			if ( '' === $key || '' === $op ) {
				++$skipped;
				continue;
			}
			$rules[] = array(
				'field'    => $key,
				'operator' => $op,
				'value'    => (string) ( $condition['value'] ?? '' ),
			);
		}
		if ( $skipped ) {
			$this->notes->skipped(
				sprintf(
					/* translators: %s: field label */
					__( 'Some conditions on \'%s\' were not copied: they use a part of a field, a field that was not imported, or a comparison SubtleForms does not have.', 'subtleforms' ),
					'' !== $label ? $label : __( 'a field', 'subtleforms' )
				)
			);
		}
		if ( ! $rules ) {
			return array();
		}
		return array(
			'action' => 'show',
			'groups' => array(
				array(
					'match' => 'any' === ( $logic['type'] ?? 'all' ) ? 'any' : 'all',
					'rules' => $rules,
				),
			),
		);
	}

	/**
	 * @param array $settings formSettings.
	 * @return array
	 */
	private function confirmation( array $settings ): array {
		$confirm = $settings['confirmation'] ?? null;
		if ( ! is_array( $confirm ) ) {
			return array();
		}
		$to = (string) ( $confirm['redirectTo'] ?? 'samePage' );
		if ( 'customUrl' === $to || 'redirect' === ( $confirm['type'] ?? '' ) ) {
			$url = trim( $this->tags( (string) ( $confirm['customUrl'] ?? $confirm['redirectUrl'] ?? '' ), false ) );
			if ( '' !== $url ) {
				return array(
					'type'        => 'redirect',
					'redirectUrl' => $url,
				);
			}
		}
		if ( 'customPage' === $to && (int) ( $confirm['customPage'] ?? 0 ) > 0 ) {
			return array(
				'type'        => 'redirect',
				'redirectUrl' => '/?page_id=' . (int) $confirm['customPage'],
			);
		}
		$message = trim( $this->tags( (string) ( $confirm['messageToShow'] ?? $confirm['message'] ?? '' ), false ) );
		if ( '' === $message ) {
			return array();
		}
		return array(
			'type'    => 'message',
			'message' => SchemaBuilder::cut( $message, SchemaBuilder::MAX_MESSAGE ),
		);
	}

	/**
	 * @param array $restrictions formSettings.restrictions.
	 * @return array
	 */
	private function restrictions( array $restrictions ): array {
		$out   = array();
		$login = $restrictions['requireLogin'] ?? array();
		if ( is_array( $login ) && ! empty( $login['enabled'] ) ) {
			$out['requireLogin'] = true;
			$message             = SchemaBuilder::plain( (string) ( $login['requireLoginMsg'] ?? '' ) );
			if ( '' !== $message ) {
				$out['loginMessage'] = SchemaBuilder::cut( $message, 500 );
			}
		}
		$limit = $restrictions['limitNumberOfEntries'] ?? array();
		if ( is_array( $limit ) && ! empty( $limit['enabled'] ) && (int) ( $limit['numberOfEntries'] ?? 0 ) > 0 ) {
			if ( in_array( (string) ( $limit['period'] ?? 'total' ), array( '', 'total' ), true ) ) {
				$out['entryLimit'] = (int) $limit['numberOfEntries'];
				$message           = SchemaBuilder::plain( (string) ( $limit['limitReachedMsg'] ?? '' ) );
				if ( '' !== $message ) {
					$out['limitMessage'] = SchemaBuilder::cut( $message, 500 );
				}
			} else {
				$this->notes->skipped( __( 'The entry limit per day, week, month or year was not copied.', 'subtleforms' ) );
			}
		}
		if ( ! empty( $restrictions['limitForm']['enabled'] ) || ! empty( $restrictions['scheduleForm']['enabled'] ) ) {
			$this->notes->skipped( __( 'The form schedule was not copied. Set opening and closing times in the form settings.', 'subtleforms' ) );
		}
		return $out;
	}

	/**
	 * @param array $notifications Fluent notifications.
	 * @return array
	 */
	private function emails( array $notifications ): array {
		$actions = array();
		$index   = 1;
		foreach ( $notifications as $note ) {
			if ( ! is_array( $note ) ) {
				continue;
			}
			$name    = SchemaBuilder::plain( (string) ( $note['name'] ?? '' ) );
			$name    = '' !== $name ? $name : sprintf( /* translators: %d: number */ __( 'Notification %d', 'subtleforms' ), $index );
			$enabled = ! isset( $note['enabled'] ) || ( (bool) $note['enabled'] && 'no' !== $note['enabled'] );
			$sendTo  = $note['sendTo'] ?? array();
			$type    = is_array( $sendTo ) ? (string) ( $sendTo['type'] ?? 'email' ) : 'email';
			$to      = $note['email'] ?? ( is_array( $sendTo ) ? ( $sendTo['email'] ?? '' ) : $sendTo );
			$to      = is_string( $to ) ? $to : '';

			if ( 'field' === $type ) {
				$key = $this->keys[ (string) ( $sendTo['field'] ?? '' ) ] ?? '';
				if ( '' !== $key ) {
					$to = '{field:' . $key . '}';
				} else {
					$to      = '{admin_email}';
					$enabled = false;
					$this->notes->changed(
						sprintf(
							/* translators: %s: notification name */
							__( 'The email \'%s\' went to an address typed in a field that was not imported. It was imported switched off.', 'subtleforms' ),
							$name
						)
					);
				}
			} elseif ( 'routing' === $type ) {
				$to      = '{admin_email}';
				$enabled = false;
				$this->notes->changed(
					sprintf(
						/* translators: %s: notification name */
						__( 'The email \'%s\' chose its address with routing rules, which were not copied. It was imported switched off and sends to the site admin email until you change it.', 'subtleforms' ),
						$name
					)
				);
			} else {
				$to = $this->tags( $to, false );
			}

			$settings = array(
				'to'      => $to,
				'subject' => $this->tags( (string) ( $note['subject'] ?? '' ), false ),
				'message' => $this->tags( (string) ( $note['message'] ?? $note['email_body'] ?? '' ), false ),
				'format'  => 'yes' === ( $note['asPlainText'] ?? 'no' ) ? 'text' : 'html',
			);
			$conditions = (array) ( $note['conditionals'] ?? array() );
			$logic      = $this->logic( $conditions, $name );
			if ( $logic ) {
				$settings['logic'] = $logic;
			} elseif ( ! empty( $conditions['status'] ) && ! empty( $conditions['conditions'] ) ) {
				$enabled = false;
				$this->notes->changed(
					sprintf(
						/* translators: %s: notification name */
						__( 'The email \'%s\' had conditions that could not be copied, so it was imported switched off.', 'subtleforms' ),
						$name
					)
				);
			}

			$headers  = array();
			$from     = trim( $this->tags( (string) ( $note['fromEmail'] ?? '' ), true ) );
			$fromName = trim( $this->tags( (string) ( $note['fromName'] ?? '' ), true ) );
			if ( '' !== $from ) {
				$headers['From'] = '' !== $fromName ? $fromName . ' <' . $from . '>' : $from;
			}
			foreach ( array( 'replyTo' => 'Reply-To', 'cc' => 'Cc', 'bcc' => 'Bcc' ) as $from_key => $header ) {
				$raw   = trim( (string) ( $note[ $from_key ] ?? '' ) );
				$value = trim( $this->tags( $raw, true ) );
				if ( '' !== $value ) {
					$headers[ $header ] = array( $value, $raw );
				}
			}
			$settings['replyTo'] = SchemaBuilder::replyTo( $headers, $name, $this->notes );
			$settings['headers'] = SchemaBuilder::headers( $headers, $name, $this->notes );
			if ( ! empty( $note['attachments'] ) || ! empty( $note['media_attachments'] ) ) {
				$this->notes->skipped(
					sprintf(
						/* translators: %s: notification name */
						__( 'The file attachments of the email \'%s\' were not copied.', 'subtleforms' ),
						$name
					)
				);
			}
			$actions[] = SchemaBuilder::email( $index, $settings, $enabled );
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
	 * Fluent smart codes (`{inputs.email}`, `{wp.admin_email}`) as SubtleForms
	 * merge tags.
	 *
	 * @param string $text   Text.
	 * @param bool   $header Whether the text is an email header.
	 * @return string
	 */
	public function tags( string $text, bool $header ): string {
		$out = preg_replace_callback(
			'/\{([^{}]*)\}/',
			function ( array $m ) use ( $header ): string {
				$inner = trim( $m[1] );
				if ( preg_match( '/^inputs\.([A-Za-z0-9_-]+)(?:\.([A-Za-z0-9_-]+))?$/', $inner, $input ) ) {
					$key = $this->keys[ $input[1] ] ?? '';
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
					if ( isset( $input[2] ) ) {
						$this->notes->changed(
							sprintf(
								/* translators: 1: merge tag, 2: field key */
								__( 'The merge tag %1$s now gives the whole answer to \'%2$s\', not one part of it.', 'subtleforms' ),
								$m[0],
								$key
							)
						);
					}
					return '{field:' . $key . '}';
				}
				switch ( $inner ) {
					case 'all_data':
					case 'all_data_without_hidden_fields':
						return '{all_fields}';
					case 'form_title':
						return '{form_title}';
					case 'wp.admin_email':
						return $header ? (string) ( $this->context['admin_email'] ?? '' ) : '{admin_email}';
					case 'wp.site_title':
						return $header ? (string) ( $this->context['site_title'] ?? '' ) : '{site_name}';
					case 'wp.site_url':
						return (string) ( $this->context['site_url'] ?? '' );
					case 'submission.id':
					case 'submission.serial_number':
						return '{entry_id}';
					case 'submission.created_at':
						return '{date}';
				}
				if ( 0 === strpos( $inner, 'date.' ) ) {
					return '{date}';
				}
				if ( preg_match( '/^[a-z_][a-z0-9_.]*$/i', $inner ) ) {
					$this->notes->skipped(
						sprintf(
							/* translators: %s: merge tag such as {ip} */
							__( 'The merge tag %s has no SubtleForms equivalent and was left as typed.', 'subtleforms' ),
							$m[0]
						)
					);
				}
				return $m[0];
			},
			$text
		);
		return is_string( $out ) ? SchemaBuilder::collapseTags( $out ) : $text;
	}
}
