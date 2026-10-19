<?php
/**
 * Import a form built in Gravity Forms or Fluent Forms.
 *
 * Payments, quizzes and add-ons are left out and named in the preview.
 * A container's fields are imported. A name or address becomes one field.
 * Anything else we cannot map is kept as a short HTML note so the question
 * is not silently dropped.
 *
 * @package SubtleForms\Tools
 */

namespace SubtleForms\Tools;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Detect, preview and convert another plugin's export.
 */
final class FormMigration {

	/**
	 * Which importer can read this file.
	 *
	 * @param array $payload Decoded JSON.
	 * @return string gravity, fluent, or an empty string.
	 */
	public static function detect( array $payload ): string {
		foreach ( self::candidates( $payload ) as $form ) {
			if ( isset( $form['form_fields'] ) ) {
				return 'fluent';
			}
			if ( self::looksLikeGravity( $form ) ) {
				return 'gravity';
			}
		}
		return '';
	}

	/**
	 * What importing would create, without writing anything.
	 *
	 * @param string $source gravity or fluent.
	 * @param array  $payload Decoded JSON.
	 * @return array{forms: array, error: string}
	 */
	public static function preview( string $source, array $payload ): array {
		$built = self::schemas( $source, $payload );
		if ( $built['error'] !== '' ) {
			return array(
				'forms' => array(),
				'error' => $built['error'],
			);
		}
		$forms = array();
		foreach ( $built['forms'] as $form ) {
			$forms[] = array(
				'title'  => $form['title'],
				'fields' => count( $form['schema']['fields'] ),
				'notes'  => $form['notes'],
			);
		}
		return array(
			'forms' => $forms,
			'error' => '',
		);
	}

	/**
	 * Schemas ready for FormsRepository::saveSchemaVersion().
	 *
	 * @param string $source gravity or fluent.
	 * @param array  $payload Decoded JSON.
	 * @return array{forms: array, error: string}
	 */
	public static function schemas( string $source, array $payload ): array {
		$raw = array();
		foreach ( self::candidates( $payload ) as $form ) {
			if ( 'gravity' === $source && self::looksLikeGravity( $form ) ) {
				$raw[] = $form;
			}
			if ( 'fluent' === $source && isset( $form['form_fields'] ) ) {
				$raw[] = $form;
			}
		}
		if ( ! $raw ) {
			return array(
				'forms' => array(),
				'error' => __( 'No forms of that kind were found in the file.', 'subtleforms' ),
			);
		}
		if ( count( $raw ) > TransferPackage::MAX_FORMS ) {
			return array(
				'forms' => array(),
				'error' => sprintf(
					/* translators: %d: maximum number of forms */
					__( 'Import up to %d forms at a time.', 'subtleforms' ),
					TransferPackage::MAX_FORMS
				),
			);
		}
		$forms = array();
		foreach ( $raw as $form ) {
			$forms[] = 'gravity' === $source ? self::fromGravity( $form ) : self::fromFluent( $form );
		}
		return array(
			'forms' => $forms,
			'error' => '',
		);
	}

	/**
	 * Possible form objects, whether the file is a list or a wrapper.
	 *
	 * @param array $payload Decoded JSON.
	 * @return array<int, array>
	 */
	private static function candidates( array $payload ): array {
		if ( isset( $payload['forms'] ) && is_array( $payload['forms'] ) ) {
			$payload = $payload['forms'];
		}
		if ( self::isForm( $payload ) ) {
			return array( $payload );
		}
		$forms = array();
		foreach ( $payload as $item ) {
			if ( self::isForm( $item ) ) {
				$forms[] = $item;
			}
		}
		return $forms;
	}

	/**
	 * @param mixed $value Value.
	 * @return bool
	 */
	private static function isForm( $value ): bool {
		return is_array( $value ) && ( isset( $value['fields'] ) || isset( $value['form_fields'] ) || isset( $value['title'] ) );
	}

	/**
	 * @param array $form Form.
	 * @return bool
	 */
	private static function looksLikeGravity( array $form ): bool {
		if ( ! isset( $form['fields'] ) || ! is_array( $form['fields'] ) ) {
			return false;
		}
		foreach ( $form['fields'] as $field ) {
			if ( is_array( $field ) && isset( $field['type'] ) && ( isset( $field['isRequired'] ) || isset( $field['choices'] ) || isset( $field['adminLabel'] ) || isset( $field['id'] ) ) ) {
				return true;
			}
		}
		return isset( $form['notifications'] ) || isset( $form['confirmations'] );
	}

	/**
	 * @param array $form Gravity form.
	 * @return array{title: string, schema: array, notes: string[]}
	 */
	private static function fromGravity( array $form ): array {
		$notes  = array();
		$used   = array();
		$idKeys = array();
		foreach ( (array) ( $form['fields'] ?? array() ) as $field ) {
			if ( ! is_array( $field ) ) {
				continue;
			}
			$id             = (string) ( $field['id'] ?? '' );
			$idKeys[ $id ]  = self::incomingKey( (string) ( $field['inputName'] ?? '' ), self::gravityLabel( $field ), $id, $used );
		}

		$fields = array();
		foreach ( (array) ( $form['fields'] ?? array() ) as $field ) {
			if ( ! is_array( $field ) ) {
				continue;
			}
			$id = (string) ( $field['id'] ?? '' );
			foreach ( self::mapGravityField( $field, $idKeys[ $id ] ?? self::key( 'field', $id, $used ), $idKeys, $notes ) as $mapped ) {
				$fields[] = $mapped;
			}
		}

		$schema            = self::schema( (string) ( $form['title'] ?? '' ), (string) ( $form['description'] ?? '' ), $fields );
		$schema['actions'] = self::gravityEmails( (array) ( $form['notifications'] ?? array() ), $idKeys, $notes );
		$confirmation      = self::gravityConfirmation( (array) ( $form['confirmations'] ?? array() ), $idKeys, $notes );
		if ( $confirmation ) {
			$schema['metadata']['confirmation'] = $confirmation;
		}
		self::noteNotifications( $schema['actions'], $notes );

		return array(
			'title'  => TransferPackage::title( (string) ( $form['title'] ?? '' ) ),
			'schema' => $schema,
			'notes'  => $notes,
		);
	}

	/**
	 * @param array $form Fluent form.
	 * @return array{title: string, schema: array, notes: string[]}
	 */
	private static function fromFluent( array $form ): array {
		$form     = self::fluentMeta( $form );
		$notes    = array();
		$used     = array();
		$fields   = array();
		$rawFields = $form['form_fields']['fields'] ?? $form['form_fields'] ?? array();
		if ( is_string( $rawFields ) ) {
			$decoded   = json_decode( $rawFields, true );
			$rawFields = is_array( $decoded ) ? ( $decoded['fields'] ?? $decoded ) : array();
		}
		foreach ( (array) $rawFields as $field ) {
			if ( ! is_array( $field ) ) {
				continue;
			}
			foreach ( self::mapFluentField( $field, $used, $notes ) as $mapped ) {
				$fields[] = $mapped;
			}
		}
		$title             = (string) ( $form['title'] ?? '' );
		$schema            = self::schema( $title, '', $fields );
		$schema['actions'] = self::fluentEmails( $form, $notes );
		$confirmation      = self::fluentConfirmation( $form, $notes );
		if ( $confirmation ) {
			$schema['metadata']['confirmation'] = $confirmation;
		}
		self::noteNotifications( $schema['actions'], $notes );

		return array(
			'title'  => TransferPackage::title( $title ),
			'schema' => $schema,
			'notes'  => $notes,
		);
	}

	/**
	 * Current Fluent exports store notifications and form settings as JSON
	 * strings on `metas` rows. Older files put them on the form itself.
	 *
	 * @param array $form Fluent form.
	 * @return array
	 */
	private static function fluentMeta( array $form ): array {
		foreach ( (array) ( $form['metas'] ?? array() ) as $row ) {
			if ( ! is_array( $row ) ) {
				continue;
			}
			$key = (string) ( $row['meta_key'] ?? $row['key'] ?? '' );
			if ( '' === $key || isset( $form[ $key ] ) ) {
				continue;
			}
			$value = $row['value'] ?? $row['meta_value'] ?? null;
			if ( is_string( $value ) ) {
				$decoded = json_decode( $value, true );
				if ( is_array( $decoded ) ) {
					$value = $decoded;
				}
			}
			if ( is_array( $value ) ) {
				$form[ $key ] = $value;
			}
		}
		return $form;
	}

	/**
	 * @param array $actions Imported email actions.
	 * @param array $notes Notes, by reference.
	 */
	private static function noteNotifications( array $actions, array &$notes ): void {
		if ( ! $actions ) {
			return;
		}
		$notes[] = sprintf(
			/* translators: %d: number of email notifications */
			__( 'Imported %d email notification(s).', 'subtleforms' ),
			count( $actions )
		);
	}

	/**
	 * The label a Gravity field should keep. An empty admin label is not a label.
	 *
	 * @param array $field Gravity field.
	 * @return string
	 */
	private static function gravityLabel( array $field ): string {
		$admin = trim( (string) ( $field['adminLabel'] ?? '' ) );
		if ( '' !== $admin ) {
			return $admin;
		}
		$label = trim( (string) ( $field['label'] ?? '' ) );
		if ( '' !== $label ) {
			return $label;
		}
		return '';
	}

	/**
	 * @param array    $field Gravity field.
	 * @param string   $key Field key already reserved for this id.
	 * @param array    $idKeys Gravity field id to SubtleForms key.
	 * @param string[] $notes Notes, by reference.
	 * @return array<int, array>
	 */
	private static function mapGravityField( array $field, string $key, array $idKeys, array &$notes ): array {
		$type     = strtolower( (string) ( $field['type'] ?? '' ) );
		$label    = self::gravityLabel( $field );
		$required = ! empty( $field['isRequired'] );
		$leftOut  = array( 'product', 'quantity', 'option', 'shipping', 'total', 'creditcard', 'stripe', 'stripe_creditcard', 'paypal', 'paypal_checkout', 'quiz', 'poll', 'survey', 'captcha', 'post_title', 'post_content', 'post_excerpt', 'post_tags', 'post_category', 'post_image', 'post_custom_field' );
		if ( in_array( $type, $leftOut, true ) ) {
			$notes[] = sprintf(
				/* translators: 1: field label, 2: original field type */
				__( '%1$s (%2$s) was left out. Payments, quizzes and post fields are not imported.', 'subtleforms' ),
				'' !== $label ? $label : $key,
				$type
			);
			return array();
		}
		if ( 'page' === $type ) {
			$built          = self::field( 'form_step', $key, '' !== $label ? $label : __( 'Step', 'subtleforms' ), false );
			$built['title'] = $built['label'];
			return array( self::withLogic( $built, $field, $idKeys, $notes ) );
		}
		if ( 'name' === $type || 'address' === $type ) {
			$notes[] = sprintf(
				/* translators: %s: field label */
				__( '%s was imported as one text field.', 'subtleforms' ),
				'' !== $label ? $label : $key
			);
			$built = self::field( 'name' === $type ? 'text' : 'textarea', $key, $label, $required );
			return array( self::withLogic( $built, $field, $idKeys, $notes ) );
		}
		if ( 'checkbox' === $type ) {
			$built = self::field( 'multiple_choice', $key, $label, $required, self::gravityChoices( $field ) );
			return array( self::withLogic( $built, $field, $idKeys, $notes ) );
		}
		if ( 'multiselect' === $type ) {
			$built                   = self::field( 'multiple_choice', $key, $label, $required, self::gravityChoices( $field ) );
			$built['allowMultiple']  = true;
			return array( self::withLogic( $built, $field, $idKeys, $notes ) );
		}

		$map = array(
			'text'       => 'text',
			'email'      => 'email',
			'textarea'   => 'textarea',
			'number'     => 'number',
			'phone'      => 'phone',
			'website'    => 'url',
			'url'        => 'url',
			'password'   => 'password',
			'select'     => 'dropdown',
			'radio'      => 'radio',
			'date'       => 'date',
			'time'       => 'time',
			'hidden'     => 'hidden',
			'fileupload' => 'file_upload',
			'file'       => 'file_upload',
			'section'    => 'section_break',
			'html'       => 'html',
			'consent'    => 'consent',
		);
		if ( isset( $map[ $type ] ) ) {
			$choices = in_array( $map[ $type ], array( 'dropdown', 'radio', 'multiple_choice' ), true ) ? self::gravityChoices( $field ) : array();
			$built   = self::field( $map[ $type ], $key, $label, $required, $choices );
			if ( 'html' === $map[ $type ] ) {
				$built['content'] = (string) ( $field['content'] ?? $label );
			}
			if ( 'consent' === $map[ $type ] ) {
				$text = trim( (string) ( $field['checkboxLabel'] ?? '' ) );
				if ( '' === $text && isset( $field['inputs'][0]['label'] ) ) {
					$text = trim( (string) $field['inputs'][0]['label'] );
				}
				if ( '' !== $text ) {
					$built['checkboxLabel'] = $text;
				}
			}
			return array( self::withLogic( $built, $field, $idKeys, $notes ) );
		}

		$notes[] = sprintf(
			/* translators: 1: field label, 2: original field type */
			__( '%1$s (%2$s) was kept as a note.', 'subtleforms' ),
			'' !== $label ? $label : $key,
			'' !== $type ? $type : 'field'
		);
		$built            = self::field( 'html', $key, $label, false );
		$built['content'] = sprintf(
			/* translators: 1: field label, 2: original field type */
			__( '%1$s was a %2$s field and was not converted.', 'subtleforms' ),
			'' !== $label ? $label : $key,
			'' !== $type ? $type : 'unknown'
		);
		return array( $built );
	}

	/**
	 * Gravity conditional logic, rewritten onto the shared logic shape.
	 * A rule we cannot map is named in the preview instead of dropped quietly.
	 *
	 * @param array    $built Mapped field.
	 * @param array    $field Gravity field.
	 * @param array    $idKeys Gravity field id to SubtleForms key.
	 * @param string[] $notes Notes, by reference.
	 * @return array
	 */
	private static function withLogic( array $built, array $field, array $idKeys, array &$notes ): array {
		$logic = $field['conditionalLogic'] ?? null;
		if ( ! is_array( $logic ) || empty( $logic['enabled'] ) ) {
			return $built;
		}
		$operators = array(
			'is'          => 'equals',
			'isnot'       => 'not_equals',
			'>'           => 'greater_than',
			'<'           => 'less_than',
			'contains'    => 'contains',
			'starts_with' => 'starts_with',
			'ends_with'   => 'ends_with',
		);
		$rules   = array();
		$skipped = false;
		foreach ( (array) ( $logic['rules'] ?? array() ) as $rule ) {
			if ( ! is_array( $rule ) ) {
				continue;
			}
			$source = $idKeys[ (string) ( $rule['fieldId'] ?? '' ) ] ?? '';
			$op     = $operators[ strtolower( (string) ( $rule['operator'] ?? 'is' ) ) ] ?? '';
			if ( '' === $source || '' === $op ) {
				$skipped = true;
				continue;
			}
			$rules[] = array(
				'field'    => $source,
				'operator' => $op,
				'value'    => (string) ( $rule['value'] ?? '' ),
			);
		}
		if ( $rules ) {
			$built['logic'] = array(
				'action' => ( 'hide' === ( $logic['actionType'] ?? 'show' ) ) ? 'hide' : 'show',
				'groups' => array(
					array(
						'match' => ( 'any' === ( $logic['logicType'] ?? 'all' ) ) ? 'any' : 'all',
						'rules' => $rules,
					),
				),
			);
		}
		if ( $skipped || ! $rules ) {
			$notes[] = sprintf(
				/* translators: %s: field label */
				__( 'Conditional logic on %s was not fully imported.', 'subtleforms' ),
				'' !== ( $built['label'] ?? '' ) ? $built['label'] : $built['key']
			);
		}
		return $built;
	}

	/**
	 * @param array    $field Fluent field.
	 * @param array    $used  Keys already used.
	 * @param string[] $notes Notes, by reference.
	 * @return array<int, array>
	 */
	private static function mapFluentField( array $field, array &$used, array &$notes ): array {
		$element  = strtolower( (string) ( $field['element'] ?? $field['type'] ?? '' ) );
		$settings = is_array( $field['settings'] ?? null ) ? $field['settings'] : array();
		$label    = self::fluentLabel( $field, $element );
		$name     = (string) ( $field['attributes']['name'] ?? $settings['name'] ?? '' );
		$key      = self::incomingKey( $name, '' !== $label ? $label : $name, $name, $used );
		$required = self::fluentRequired( $field );

		if ( 'container' === $element ) {
			return self::fluentContainer( $field, $used, $notes, $label );
		}
		if ( self::fluentPayment( $element ) ) {
			$notes[] = sprintf(
				/* translators: 1: field label, 2: original field type */
				__( '%1$s (%2$s) was left out. Payments and quizzes are not imported.', 'subtleforms' ),
				'' !== $label ? $label : $key,
				$element
			);
			return array();
		}
		if ( 'form_step' === $element ) {
			$built          = self::field( 'form_step', $key, '' !== $label ? $label : __( 'Step', 'subtleforms' ), false );
			$built['title'] = (string) ( $settings['step_title'] ?? $settings['title'] ?? $built['label'] );
			return array( $built );
		}
		if ( 'input_hidden' === $element ) {
			$built          = self::field( 'hidden', $key, '' !== $label ? $label : $name, false );
			$built['value'] = (string) ( $settings['value'] ?? $field['attributes']['value'] ?? '' );
			return array( $built );
		}
		if ( in_array( $element, array( 'input_name', 'address' ), true ) ) {
			$notes[] = sprintf(
				/* translators: %s: field label */
				__( '%s was imported as one text field.', 'subtleforms' ),
				'' !== $label ? $label : $key
			);
			return array( self::field( 'input_name' === $element ? 'text' : 'textarea', $key, $label, $required ) );
		}
		if ( 'input_checkbox' === $element ) {
			return array( self::field( 'multiple_choice', $key, $label, $required, self::fluentChoices( $field ) ) );
		}

		$map = array(
			'input_text'          => 'text',
			'input_email'         => 'email',
			'textarea'            => 'textarea',
			'input_number'        => 'number',
			'phone'               => 'phone',
			'input_url'           => 'url',
			'input_password'      => 'password',
			'select'              => 'dropdown',
			'dropdown'            => 'dropdown',
			'input_radio'         => 'radio',
			'input_date'          => 'date',
			'input_file'          => 'file_upload',
			'custom_html'         => 'html',
			'section_break'       => 'section_break',
			'terms_and_condition' => 'consent',
		);
		if ( isset( $map[ $element ] ) ) {
			$choices = in_array( $map[ $element ], array( 'dropdown', 'radio' ), true ) ? self::fluentChoices( $field ) : array();
			$built   = self::field( $map[ $element ], $key, $label, $required, $choices );
			if ( 'html' === $map[ $element ] ) {
				$built['content'] = (string) ( $settings['html_codes'] ?? $settings['content'] ?? $label );
			}
			return array( $built );
		}

		$notes[] = sprintf(
			/* translators: 1: field label, 2: original field type */
			__( '%1$s (%2$s) was kept as a note.', 'subtleforms' ),
			'' !== $label ? $label : $key,
			'' !== $element ? $element : 'field'
		);
		$built            = self::field( 'html', $key, $label, false );
		$built['content'] = sprintf(
			/* translators: 1: field label, 2: original field type */
			__( '%1$s was a %2$s field and was not converted.', 'subtleforms' ),
			'' !== $label ? $label : $key,
			'' !== $element ? $element : 'unknown'
		);
		return array( $built );
	}

	/**
	 * Columns of a Fluent container become real fields, not a note the visitor sees.
	 *
	 * @param array    $field Container field.
	 * @param array    $used Keys already used.
	 * @param string[] $notes Notes, by reference.
	 * @param string   $label Container label.
	 * @return array<int, array>
	 */
	private static function fluentContainer( array $field, array &$used, array &$notes, string $label ): array {
		$settings = is_array( $field['settings'] ?? null ) ? $field['settings'] : array();
		$columns  = $field['columns'] ?? $settings['columns'] ?? array();
		$children = array();
		foreach ( (array) $columns as $column ) {
			if ( ! is_array( $column ) ) {
				continue;
			}
			$inner = isset( $column['fields'] ) && is_array( $column['fields'] ) ? $column['fields'] : $column;
			foreach ( $inner as $child ) {
				if ( ! is_array( $child ) || isset( $child['width'] ) && ! isset( $child['element'] ) && ! isset( $child['type'] ) ) {
					continue;
				}
				if ( ! isset( $child['element'] ) && ! isset( $child['type'] ) ) {
					continue;
				}
				foreach ( self::mapFluentField( $child, $used, $notes ) as $mapped ) {
					$children[] = $mapped;
				}
			}
		}
		if ( ! $children ) {
			$notes[] = sprintf(
				/* translators: %s: field label */
				__( '%s was a container with no fields.', 'subtleforms' ),
				'' !== $label ? $label : __( 'A field', 'subtleforms' )
			);
		}
		return $children;
	}

	/**
	 * Payment, coupon, quantity and summary fields are left out of the form.
	 *
	 * @param string $element Fluent element name.
	 * @return bool
	 */
	private static function fluentPayment( string $element ): bool {
		if ( in_array( $element, array( 'payment_method', 'subscription_payment', 'multi_payment', 'custom_payment_amount', 'quiz', 'ratings' ), true ) ) {
			return true;
		}
		return str_ends_with( $element, '_component' );
	}

	/**
	 * @param array  $field Fluent field.
	 * @param string $element Element name.
	 * @return string
	 */
	private static function fluentLabel( array $field, string $element ): string {
		$settings = is_array( $field['settings'] ?? null ) ? $field['settings'] : array();
		foreach ( array( $settings['label'] ?? '', $settings['admin_field_label'] ?? '', $field['admin_field_label'] ?? '', $field['label'] ?? '' ) as $candidate ) {
			$candidate = trim( (string) $candidate );
			if ( '' !== $candidate ) {
				return $candidate;
			}
		}
		if ( 'input_name' === $element ) {
			return __( 'Name', 'subtleforms' );
		}
		return '';
	}

	/**
	 * @param array $field Fluent field.
	 * @return bool
	 */
	private static function fluentRequired( array $field ): bool {
		if ( ! empty( $field['required'] ) ) {
			return true;
		}
		$settings = is_array( $field['settings'] ?? null ) ? $field['settings'] : array();
		if ( ! empty( $settings['required'] ) ) {
			return true;
		}
		$rules = $settings['validation_rules'] ?? array();
		if ( ! empty( $rules['required']['value'] ) ) {
			return true;
		}
		foreach ( (array) $rules as $rule ) {
			if ( is_array( $rule ) && ( 'required' === ( $rule['type'] ?? '' ) || ! empty( $rule['required'] ) ) ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * @param string $type Field type.
	 * @param string $key Field key.
	 * @param string $label Label.
	 * @param bool   $required Required.
	 * @param array  $options Choices.
	 * @return array
	 */
	private static function field( string $type, string $key, string $label, bool $required, array $options = array() ): array {
		$field = array(
			'id'       => $key,
			'key'      => $key,
			'type'     => $type,
			'label'    => $label,
			'required' => $required,
		);
		if ( $options ) {
			$field['options'] = $options;
		}
		return $field;
	}

	/**
	 * @param array $field Gravity field.
	 * @return array<int, array{label: string, value: string}>
	 */
	private static function gravityChoices( array $field ): array {
		$options = array();
		foreach ( (array) ( $field['choices'] ?? array() ) as $choice ) {
			if ( ! is_array( $choice ) ) {
				continue;
			}
			$label = (string) ( $choice['text'] ?? $choice['label'] ?? '' );
			$value = (string) ( $choice['value'] ?? $label );
			if ( '' === $label && '' === $value ) {
				continue;
			}
			$options[] = array(
				'label' => '' !== $label ? $label : $value,
				'value' => '' !== $value ? $value : $label,
			);
		}
		return $options;
	}

	/**
	 * @param array $field Fluent field.
	 * @return array<int, array{label: string, value: string}>
	 */
	private static function fluentChoices( array $field ): array {
		$settings = is_array( $field['settings'] ?? null ) ? $field['settings'] : array();
		$raw      = $settings['advanced_options'] ?? $settings['options'] ?? $field['options'] ?? array();
		$options  = array();
		foreach ( (array) $raw as $choice ) {
			if ( ! is_array( $choice ) ) {
				continue;
			}
			$label = (string) ( $choice['label'] ?? $choice['text'] ?? '' );
			$value = (string) ( $choice['value'] ?? $label );
			if ( '' === $label && '' === $value ) {
				continue;
			}
			$options[] = array(
				'label' => '' !== $label ? $label : $value,
				'value' => '' !== $value ? $value : $label,
			);
		}
		return $options;
	}

	/**
	 * @param array    $notifications Gravity notifications keyed by id.
	 * @param array    $idKeys Gravity field id to SubtleForms key.
	 * @param string[] $notes Notes, by reference.
	 * @return array
	 */
	private static function gravityEmails( array $notifications, array $idKeys, array &$notes ): array {
		$actions = array();
		$index   = 1;
		foreach ( $notifications as $note ) {
			if ( ! is_array( $note ) ) {
				continue;
			}
			$to = (string) ( $note['to'] ?? '{admin_email}' );
			if ( 'field' === ( $note['toType'] ?? '' ) ) {
				$target = $idKeys[ (string) ( $note['to'] ?? '' ) ] ?? '';
				if ( '' !== $target ) {
					$to = '{field:' . $target . '}';
				} else {
					$notes[] = __( 'A notification was addressed to a field that was not imported.', 'subtleforms' );
				}
			}
			$actions[] = array(
				'id'       => 'imported_' . $index,
				'type'     => 'email',
				'enabled'  => ! isset( $note['isActive'] ) || (bool) $note['isActive'],
				'settings' => array(
					'to'      => self::rewriteTags( $to, $idKeys, $notes ),
					'subject' => self::rewriteTags( (string) ( $note['subject'] ?? __( 'New entry', 'subtleforms' ) ), $idKeys, $notes ),
					'message' => self::rewriteTags( (string) ( $note['message'] ?? '' ), $idKeys, $notes ),
					'format'  => 'html',
				),
			);
			++$index;
		}
		return $actions;
	}

	/**
	 * @param array    $confirmations Gravity confirmations.
	 * @param array    $idKeys Gravity field id to SubtleForms key.
	 * @param string[] $notes Notes, by reference.
	 * @return array
	 */
	private static function gravityConfirmation( array $confirmations, array $idKeys, array &$notes ): array {
		$chosen = null;
		foreach ( $confirmations as $item ) {
			if ( ! is_array( $item ) ) {
				continue;
			}
			if ( ! empty( $item['isDefault'] ) || null === $chosen ) {
				$chosen = $item;
			}
		}
		if ( ! $chosen ) {
			return array();
		}
		$type = (string) ( $chosen['type'] ?? 'message' );
		if ( 'page' === $type ) {
			$pageId = (int) ( $chosen['pageId'] ?? $chosen['page_id'] ?? 0 );
			if ( $pageId > 0 ) {
				$notes[] = sprintf(
					/* translators: %d: WordPress page id */
					__( 'The confirmation opens WordPress page %d.', 'subtleforms' ),
					$pageId
				);
				return array(
					'type'        => 'redirect',
					'redirectUrl' => '/?page_id=' . $pageId,
				);
			}
			$notes[] = __( 'The page confirmation had no page, so the message is used instead.', 'subtleforms' );
			$message = self::rewriteTags( (string) ( $chosen['message'] ?? '' ), $idKeys, $notes );
			return '' === $message ? array() : array(
				'type'    => 'message',
				'message' => $message,
			);
		}
		if ( 'redirect' === $type ) {
			$url = self::rewriteTags( (string) ( $chosen['url'] ?? '' ), $idKeys, $notes );
			if ( '' === $url ) {
				$notes[] = __( 'The redirect confirmation had no address, so the default message is used.', 'subtleforms' );
				return array();
			}
			return array(
				'type'        => 'redirect',
				'redirectUrl' => $url,
			);
		}
		return array(
			'type'    => 'message',
			'title'   => (string) ( $chosen['name'] ?? '' ),
			'message' => self::rewriteTags( (string) ( $chosen['message'] ?? '' ), $idKeys, $notes ),
		);
	}

	/**
	 * Turn `{Label:1.3}` and `{inputs.email}` into `{field:key}`.
	 *
	 * @param string   $text Text that may contain merge tags.
	 * @param array    $idKeys Gravity field id to SubtleForms key.
	 * @param string[] $notes Notes, by reference.
	 * @return string
	 */
	private static function rewriteTags( string $text, array $idKeys, array &$notes ): string {
		$replaced = preg_replace_callback(
			'/\{([^{}]*)\}/',
			static function ( array $match ) use ( $idKeys, &$notes ): string {
				$inner = $match[1];
				if ( preg_match( '/:(\d+)(?:\.\d+)?$/', $inner, $id ) ) {
					$key = $idKeys[ $id[1] ] ?? '';
					if ( '' !== $key ) {
						return '{field:' . $key . '}';
					}
					$notes[] = __( 'A merge tag pointed at a field that was not imported.', 'subtleforms' );
					return $match[0];
				}
				if ( preg_match( '/^(?:inputs|field)\.([A-Za-z0-9_]+)$/', $inner, $name ) ) {
					return '{field:' . $name[1] . '}';
				}
				return $match[0];
			},
			$text
		);
		return is_string( $replaced ) ? $replaced : $text;
	}

	/**
	 * One notification object, a list, or a map of notifications.
	 *
	 * @param array $notes Raw notifications value.
	 * @return array<int, array>
	 */
	private static function notificationList( array $notes ): array {
		if ( ! $notes ) {
			return array();
		}
		if ( array_is_list( $notes ) ) {
			return $notes;
		}
		if ( isset( $notes['sendTo'] ) || isset( $notes['subject'] ) || isset( $notes['email'] ) || isset( $notes['email_body'] ) || isset( $notes['message'] ) || isset( $notes['to'] ) ) {
			return array( $notes );
		}
		$list = array();
		foreach ( $notes as $note ) {
			if ( is_array( $note ) ) {
				$list[] = $note;
			}
		}
		return $list;
	}

	/**
	 * @param array    $form Fluent form.
	 * @param string[] $notes Notes, by reference.
	 * @return array
	 */
	private static function fluentEmails( array $form, array &$notes ): array {
		$raw = $form['notifications'] ?? $form['formSettings']['notifications'] ?? array();
		if ( ! is_array( $raw ) ) {
			return array();
		}
		$actions = array();
		$index   = 1;
		foreach ( self::notificationList( $raw ) as $note ) {
			if ( ! is_array( $note ) ) {
				continue;
			}
			$to = $note['email'] ?? $note['sendTo']['email'] ?? $note['sendTo'] ?? '{admin_email}';
			if ( ! is_string( $to ) ) {
				$to = '{admin_email}';
			}
			$actions[] = array(
				'id'       => 'imported_' . $index,
				'type'     => 'email',
				'enabled'  => ! isset( $note['enabled'] ) || (bool) $note['enabled'],
				'settings' => array(
					'to'      => self::rewriteTags( $to, array(), $notes ),
					'subject' => self::rewriteTags( (string) ( $note['subject'] ?? __( 'New entry', 'subtleforms' ) ), array(), $notes ),
					'message' => self::rewriteTags( (string) ( $note['message'] ?? $note['email_body'] ?? '' ), array(), $notes ),
					'format'  => 'html',
				),
			);
			++$index;
		}
		return $actions;
	}

	/**
	 * @param array    $form Fluent form.
	 * @param string[] $notes Notes, by reference.
	 * @return array
	 */
	private static function fluentConfirmation( array $form, array &$notes ): array {
		$settings = is_array( $form['formSettings'] ?? null ) ? $form['formSettings'] : array();
		$confirm  = $settings['confirmation'] ?? $form['confirmation'] ?? null;
		if ( ! is_array( $confirm ) ) {
			return array();
		}
		if ( ( $confirm['redirectTo'] ?? '' ) === 'customUrl' || ( $confirm['type'] ?? '' ) === 'redirect' ) {
			return array(
				'type'        => 'redirect',
				'redirectUrl' => self::rewriteTags( (string) ( $confirm['customUrl'] ?? $confirm['redirectUrl'] ?? '' ), array(), $notes ),
			);
		}
		$message = self::rewriteTags( (string) ( $confirm['messageToShow'] ?? $confirm['message'] ?? '' ), array(), $notes );
		if ( '' === $message ) {
			return array();
		}
		return array(
			'type'    => 'message',
			'message' => $message,
		);
	}

	/**
	 * @param string $title Form title.
	 * @param string $description Description.
	 * @param array  $fields Fields.
	 * @return array
	 */
	private static function schema( string $title, string $description, array $fields ): array {
		$schema = array(
			'schema_version' => 1,
			'metadata'       => array(
				'name'        => 'form_schema',
				'title'       => TransferPackage::title( $title ),
				'description' => $description,
				'type'        => 'regular',
			),
			'fields'         => $fields,
			'actions'        => array(),
		);
		list( $schema ) = \SubtleForms\Support\SchemaRepair::syncType( $schema );
		return $schema;
	}

	/**
	 * The field ID for an imported field: the name the other plugin used when
	 * it is valid and unused, otherwise one made from the label.
	 *
	 * @param string $incoming Field name in the other plugin.
	 * @param string $label    Label for the fallback.
	 * @param string $id       Original field ID, for the fallback.
	 * @param array  $used     Keys already used, by reference.
	 * @return string
	 */
	private static function incomingKey( string $incoming, string $label, string $id, array &$used ): string {
		// The field name the other plugin used (Fluent Forms' name, a Gravity
		// Forms parameter name) is kept when it is a valid, unused field ID,
		// so imported entries and integrations keep matching (2.4.1).
		$incoming = trim( $incoming );
		if ( '' !== $incoming
			&& preg_match( '/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/', $incoming )
			&& ! in_array( $incoming, \SubtleForms\Support\SchemaValidator::RESERVED_KEYS, true )
			&& ! isset( $used[ $incoming ] ) ) {
			$used[ $incoming ] = true;
			return $incoming;
		}
		return self::key( $label, $id, $used );
	}

	/**
	 * A field key that the schema validator accepts, made from a label.
	 *
	 * @param string $label Preferred label or name.
	 * @param string $id    Fallback id.
	 * @param array  $used  Keys already used.
	 * @return string
	 */
	private static function key( string $label, string $id, array &$used ): string {
		$base = strtolower( (string) preg_replace( '/[^a-z0-9]+/i', '_', $label ) );
		$base = trim( $base, '_' );
		if ( '' === $base || ! preg_match( '/^[a-z]/', $base ) ) {
			$fallback = strtolower( (string) preg_replace( '/[^a-z0-9]+/i', '_', $id ) );
			$fallback = trim( $fallback, '_' );
			$base     = '' !== $fallback ? 'field_' . $fallback : 'field';
		}
		$base = substr( $base, 0, 40 );
		$key  = $base;
		$n    = 2;
		while ( isset( $used[ $key ] ) ) {
			$key = substr( $base, 0, 36 ) . '_' . $n;
			++$n;
		}
		$used[ $key ] = true;
		return $key;
	}
}
