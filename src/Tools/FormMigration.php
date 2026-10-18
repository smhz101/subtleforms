<?php
/**
 * Import a form built in Gravity Forms or Fluent Forms.
 *
 * Payments, quizzes and add-ons are left out and named in the preview.
 * A name or address becomes one field. Anything else we cannot map is
 * kept as a short HTML note so the question is not silently dropped.
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
		$fields = array();
		foreach ( (array) ( $form['fields'] ?? array() ) as $field ) {
			if ( ! is_array( $field ) ) {
				continue;
			}
			$mapped = self::mapGravityField( $field, $used, $notes );
			if ( $mapped ) {
				$fields[] = $mapped;
			}
		}
		$schema = self::schema( (string) ( $form['title'] ?? '' ), (string) ( $form['description'] ?? '' ), $fields );
		$schema['actions'] = self::gravityEmails( (array) ( $form['notifications'] ?? array() ) );
		$confirmation      = self::gravityConfirmation( (array) ( $form['confirmations'] ?? array() ) );
		if ( $confirmation ) {
			$schema['metadata']['confirmation'] = $confirmation;
		}
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
			$mapped = self::mapFluentField( $field, $used, $notes );
			if ( $mapped ) {
				$fields[] = $mapped;
			}
		}
		$title  = (string) ( $form['title'] ?? '' );
		$schema = self::schema( $title, '', $fields );
		$schema['actions'] = self::fluentEmails( $form );
		$confirmation      = self::fluentConfirmation( $form );
		if ( $confirmation ) {
			$schema['metadata']['confirmation'] = $confirmation;
		}
		return array(
			'title'  => TransferPackage::title( $title ),
			'schema' => $schema,
			'notes'  => $notes,
		);
	}

	/**
	 * @param array    $field Gravity field.
	 * @param array    $used  Keys already used.
	 * @param string[] $notes Notes, by reference.
	 * @return array|null
	 */
	private static function mapGravityField( array $field, array &$used, array &$notes ): ?array {
		$type  = strtolower( (string) ( $field['type'] ?? '' ) );
		$label = (string) ( $field['label'] ?? '' );
		$key   = self::key( (string) ( $field['adminLabel'] ?? $label ), (string) ( $field['id'] ?? '' ), $used );
		$map   = array(
			'text'       => 'text',
			'email'      => 'email',
			'textarea'   => 'textarea',
			'number'     => 'number',
			'phone'      => 'phone',
			'website'    => 'url',
			'url'        => 'url',
			'password'   => 'password',
			'select'     => 'dropdown',
			'multiselect'=> 'dropdown',
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
		if ( in_array( $type, array( 'product', 'quantity', 'option', 'shipping', 'total', 'creditcard', 'quiz', 'poll', 'survey', 'captcha', 'post_title', 'post_content', 'post_excerpt', 'post_tags', 'post_category', 'post_image', 'post_custom_field' ), true ) ) {
			$notes[] = sprintf(
				/* translators: 1: field label, 2: original field type */
				__( '%1$s (%2$s) was left out. Payments, quizzes and post fields are not imported.', 'subtleforms' ),
				'' !== $label ? $label : $key,
				$type
			);
			return null;
		}
		if ( 'name' === $type || 'address' === $type ) {
			$notes[] = sprintf(
				/* translators: %s: field label */
				__( '%s was imported as one text field.', 'subtleforms' ),
				'' !== $label ? $label : $key
			);
			return self::field( 'name' === $type ? 'text' : 'textarea', $key, $label, ! empty( $field['isRequired'] ) );
		}
		if ( 'checkbox' === $type ) {
			return self::field( 'multiple_choice', $key, $label, ! empty( $field['isRequired'] ), self::gravityChoices( $field ) );
		}
		if ( 'page' === $type ) {
			return self::field( 'section_break', $key, $label, false );
		}
		if ( isset( $map[ $type ] ) ) {
			$choices = in_array( $map[ $type ], array( 'dropdown', 'radio' ), true ) ? self::gravityChoices( $field ) : array();
			$built   = self::field( $map[ $type ], $key, $label, ! empty( $field['isRequired'] ), $choices );
			if ( 'html' === $map[ $type ] ) {
				$built['content'] = (string) ( $field['content'] ?? $label );
			}
			return $built;
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
		return $built;
	}

	/**
	 * @param array    $field Fluent field.
	 * @param array    $used  Keys already used.
	 * @param string[] $notes Notes, by reference.
	 * @return array|null
	 */
	private static function mapFluentField( array $field, array &$used, array &$notes ): ?array {
		$element  = strtolower( (string) ( $field['element'] ?? $field['type'] ?? '' ) );
		$settings = is_array( $field['settings'] ?? null ) ? $field['settings'] : array();
		$label    = (string) ( $settings['label'] ?? $field['label'] ?? '' );
		$name     = (string) ( $field['attributes']['name'] ?? $settings['name'] ?? '' );
		$key      = self::key( '' !== $name ? $name : $label, '', $used );
		$required = ! empty( $settings['validation_rules']['required']['value'] ) || ! empty( $field['required'] );
		$map      = array(
			'input_text'     => 'text',
			'input_email'    => 'email',
			'textarea'       => 'textarea',
			'input_number'   => 'number',
			'phone'          => 'phone',
			'input_url'      => 'url',
			'input_password' => 'password',
			'select'         => 'dropdown',
			'dropdown'       => 'dropdown',
			'input_radio'    => 'radio',
			'input_date'     => 'date',
			'input_file'     => 'file_upload',
			'custom_html'    => 'html',
			'section_break'  => 'section_break',
			'terms_and_condition' => 'consent',
		);
		if ( in_array( $element, array( 'payment_method', 'subscription_payment', 'multi_payment', 'quiz', 'ratings' ), true ) ) {
			$notes[] = sprintf(
				/* translators: 1: field label, 2: original field type */
				__( '%1$s (%2$s) was left out. Payments and quizzes are not imported.', 'subtleforms' ),
				'' !== $label ? $label : $key,
				$element
			);
			return null;
		}
		if ( in_array( $element, array( 'input_name', 'address' ), true ) ) {
			$notes[] = sprintf(
				/* translators: %s: field label */
				__( '%s was imported as one text field.', 'subtleforms' ),
				'' !== $label ? $label : $key
			);
			return self::field( 'input_name' === $element ? 'text' : 'textarea', $key, $label, $required );
		}
		if ( 'input_checkbox' === $element ) {
			return self::field( 'multiple_choice', $key, $label, $required, self::fluentChoices( $field ) );
		}
		if ( isset( $map[ $element ] ) ) {
			$choices = in_array( $map[ $element ], array( 'dropdown', 'radio' ), true ) ? self::fluentChoices( $field ) : array();
			$built   = self::field( $map[ $element ], $key, $label, $required, $choices );
			if ( 'html' === $map[ $element ] ) {
				$built['content'] = (string) ( $settings['html_codes'] ?? $settings['content'] ?? $label );
			}
			return $built;
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
		return $built;
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
	 * @param array $notifications Gravity notifications keyed by id.
	 * @return array
	 */
	private static function gravityEmails( array $notifications ): array {
		$actions = array();
		$index   = 1;
		foreach ( $notifications as $id => $note ) {
			if ( ! is_array( $note ) ) {
				continue;
			}
			$actions[] = array(
				'id'       => 'imported_' . $index,
				'type'     => 'email',
				'enabled'  => ! isset( $note['isActive'] ) || (bool) $note['isActive'],
				'settings' => array(
					'to'      => (string) ( $note['to'] ?? '{admin_email}' ),
					'subject' => (string) ( $note['subject'] ?? __( 'New entry', 'subtleforms' ) ),
					'message' => (string) ( $note['message'] ?? '' ),
					'format'  => 'html',
				),
			);
			++$index;
		}
		return $actions;
	}

	/**
	 * @param array $confirmations Gravity confirmations.
	 * @return array
	 */
	private static function gravityConfirmation( array $confirmations ): array {
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
		if ( 'redirect' === $type || 'page' === $type ) {
			return array(
				'type'        => 'redirect',
				'redirectUrl' => (string) ( $chosen['url'] ?? '' ),
			);
		}
		return array(
			'type'    => 'message',
			'title'   => (string) ( $chosen['name'] ?? '' ),
			'message' => (string) ( $chosen['message'] ?? '' ),
		);
	}

	/**
	 * @param array $form Fluent form.
	 * @return array
	 */
	private static function fluentEmails( array $form ): array {
		$notes = $form['notifications'] ?? $form['formSettings']['notifications'] ?? array();
		if ( ! is_array( $notes ) ) {
			return array();
		}
		$actions = array();
		$index   = 1;
		foreach ( $notes as $note ) {
			if ( ! is_array( $note ) ) {
				continue;
			}
			$to = $note['email'] ?? $note['sendTo']['email'] ?? '{admin_email}';
			$actions[] = array(
				'id'       => 'imported_' . $index,
				'type'     => 'email',
				'enabled'  => ! isset( $note['enabled'] ) || (bool) $note['enabled'],
				'settings' => array(
					'to'      => is_string( $to ) ? $to : '{admin_email}',
					'subject' => (string) ( $note['subject'] ?? __( 'New entry', 'subtleforms' ) ),
					'message' => (string) ( $note['message'] ?? $note['email_body'] ?? '' ),
					'format'  => 'html',
				),
			);
			++$index;
		}
		return $actions;
	}

	/**
	 * @param array $form Fluent form.
	 * @return array
	 */
	private static function fluentConfirmation( array $form ): array {
		$settings = is_array( $form['formSettings'] ?? null ) ? $form['formSettings'] : array();
		$confirm  = $settings['confirmation'] ?? $form['confirmation'] ?? null;
		if ( ! is_array( $confirm ) ) {
			return array();
		}
		if ( ( $confirm['redirectTo'] ?? '' ) === 'customUrl' || ( $confirm['type'] ?? '' ) === 'redirect' ) {
			return array(
				'type'        => 'redirect',
				'redirectUrl' => (string) ( $confirm['customUrl'] ?? $confirm['redirectUrl'] ?? '' ),
			);
		}
		$message = (string) ( $confirm['messageToShow'] ?? $confirm['message'] ?? '' );
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
		return array(
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
	}

	/**
	 * A field key that the schema validator accepts.
	 *
	 * @param string $label Preferred label or name.
	 * @param string $id Fallback id.
	 * @param array  $used Keys already used.
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
