<?php
/**
 * Import a form from a Gravity Forms, Fluent Forms, WPForms or Ninja Forms export file.
 *
 * The fields are mapped by the same mappers as the one-click import in
 * Tools, Migrate (Import\GravityMapper, Import\FluentMapper), so a form
 * comes across the same way whether it was read from the site or from a
 * file. Anything that is not copied is named in the preview.
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
	 * @return string gravity, fluent, wpforms, ninja, or an empty string.
	 */
	public static function detect( array $payload ): string {
		foreach ( self::candidates( $payload ) as $form ) {
			if ( isset( $form['form_fields'] ) ) {
				return 'fluent';
			}
			if ( self::looksLikeNinja( $form ) ) {
				return 'ninja';
			}
			if ( self::looksLikeWpforms( $form ) ) {
				return 'wpforms';
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
				'fields' => Import\SchemaBuilder::countFields( (array) $form['schema']['fields'] ),
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
			if ( 'ninja' === $source && self::looksLikeNinja( $form ) ) {
				$raw[] = $form;
			}
			if ( 'wpforms' === $source && self::looksLikeWpforms( $form ) ) {
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
			if ( 'gravity' === $source ) {
				$forms[] = self::fromGravity( $form );
			} elseif ( 'wpforms' === $source ) {
				$forms[] = self::result( Import\WPFormsMapper::map( $form, array_merge( self::context(), array( 'from_file' => true ) ) ) );
			} elseif ( 'ninja' === $source ) {
				$forms[] = self::result( Import\NinjaMapper::map( $form, self::context() ) );
			} else {
				$forms[] = self::fromFluent( $form );
			}
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
	 * A Ninja Forms export: a list of fields that carry a type, and a list of actions.
	 *
	 * @param array $form Form.
	 * @return bool
	 */
	private static function looksLikeNinja( array $form ): bool {
		if ( ! isset( $form['fields'], $form['actions'] ) || ! is_array( $form['fields'] ) || ! is_array( $form['actions'] ) || ! array_is_list( $form['fields'] ) ) {
			return false;
		}
		foreach ( $form['fields'] as $field ) {
			if ( is_array( $field ) && ( isset( $field['type'] ) || isset( $field['settings']['type'] ) ) ) {
				return true;
			}
		}
		return ! $form['fields'];
	}

	/**
	 * A WPForms export: fields keyed by id, and settings with the form title.
	 *
	 * @param array $form Form.
	 * @return bool
	 */
	private static function looksLikeWpforms( array $form ): bool {
		if ( ! isset( $form['fields'], $form['settings'] ) || ! is_array( $form['fields'] ) || ! is_array( $form['settings'] ) ) {
			return false;
		}
		return isset( $form['field_id'] ) || isset( $form['settings']['form_title'] ) || isset( $form['settings']['submit_text'] );
	}

	/**
	 * @param array $form Form.
	 * @return bool
	 */
	private static function looksLikeGravity( array $form ): bool {
		if ( self::looksLikeWpforms( $form ) || self::looksLikeNinja( $form ) ) {
			return false;
		}
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
	 * Site facts for email headers, when WordPress is loaded.
	 *
	 * @return array
	 */
	private static function context(): array {
		return function_exists( 'home_url' ) && function_exists( 'get_bloginfo' ) ? Import\Importer::context() : array();
	}

	/**
	 * @param array $form Gravity form.
	 * @return array{title: string, schema: array, notes: string[]}
	 */
	private static function fromGravity( array $form ): array {
		return self::result( Import\GravityMapper::map( $form, self::context() ) );
	}

	/**
	 * @param array $form Fluent form.
	 * @return array{title: string, schema: array, notes: string[]}
	 */
	private static function fromFluent( array $form ): array {
		return self::result( Import\FluentMapper::map( $form, self::context() ) );
	}

	/**
	 * @param array $mapped Mapper result.
	 * @return array{title: string, schema: array, notes: string[]}
	 */
	private static function result( array $mapped ): array {
		return array(
			'title'  => (string) $mapped['title'],
			'schema' => (array) $mapped['schema'],
			'notes'  => $mapped['notes'] instanceof Import\ImportNotes ? $mapped['notes']->strings() : array(),
		);
	}
}
