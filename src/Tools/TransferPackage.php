<?php
/**
 * SubtleForms transfer packages.
 *
 * The JSON a site exports and another site imports. No database access.
 *
 * @package SubtleForms\Tools
 */

namespace SubtleForms\Tools;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Build and read form and submission packages.
 */
final class TransferPackage {

	public const VERSION = 1;

	public const MAX_FORMS       = 100;
	public const MAX_SUBMISSIONS = 2000;

	/**
	 * A forms package.
	 *
	 * @param array<int, array{title: string, status: string, schema: array}> $forms Forms.
	 * @return array
	 */
	public static function forms( array $forms ): array {
		return array(
			'subtleforms' => self::VERSION,
			'kind'        => 'forms',
			'exported_at' => gmdate( 'c' ),
			'forms'       => array_values( $forms ),
		);
	}

	/**
	 * A submissions package for one form.
	 *
	 * @param array $form        Form id and title.
	 * @param array $submissions Rows.
	 * @return array
	 */
	public static function submissions( array $form, array $submissions ): array {
		return array(
			'subtleforms' => self::VERSION,
			'kind'        => 'submissions',
			'exported_at' => gmdate( 'c' ),
			'form'        => array(
				'id'    => (int) ( $form['id'] ?? 0 ),
				'title' => (string) ( $form['title'] ?? '' ),
			),
			'submissions' => array_values( $submissions ),
		);
	}

	/**
	 * Forms inside a package, or an error message.
	 *
	 * @param array $package Decoded JSON.
	 * @return array{forms: array, error: string}
	 */
	public static function readForms( array $package ): array {
		if ( ( $package['kind'] ?? '' ) !== 'forms' || (int) ( $package['subtleforms'] ?? 0 ) !== self::VERSION ) {
			return array(
				'forms' => array(),
				'error' => __( 'This file is not a SubtleForms forms export.', 'subtleforms' ),
			);
		}
		$forms = $package['forms'] ?? null;
		if ( ! is_array( $forms ) || ! $forms ) {
			return array(
				'forms' => array(),
				'error' => __( 'The export does not contain any forms.', 'subtleforms' ),
			);
		}
		if ( count( $forms ) > self::MAX_FORMS ) {
			return array(
				'forms' => array(),
				'error' => sprintf(
					/* translators: %d: maximum number of forms */
					__( 'Import up to %d forms at a time.', 'subtleforms' ),
					self::MAX_FORMS
				),
			);
		}
		$clean = array();
		foreach ( $forms as $form ) {
			if ( ! is_array( $form ) || ! is_array( $form['schema'] ?? null ) ) {
				continue;
			}
			$status = (string) ( $form['status'] ?? 'draft' );
			if ( ! in_array( $status, array( 'draft', 'published' ), true ) ) {
				$status = 'draft';
			}
			$clean[] = array(
				'title'  => self::title( (string) ( $form['title'] ?? '' ) ),
				'status' => $status,
				'schema' => $form['schema'],
			);
		}
		if ( ! $clean ) {
			return array(
				'forms' => array(),
				'error' => __( 'None of the forms in this file could be read.', 'subtleforms' ),
			);
		}
		return array(
			'forms' => $clean,
			'error' => '',
		);
	}

	/**
	 * Submissions inside a package, or an error message.
	 *
	 * @param array $package Decoded JSON.
	 * @return array{submissions: array, error: string}
	 */
	public static function readSubmissions( array $package ): array {
		if ( ( $package['kind'] ?? '' ) !== 'submissions' || (int) ( $package['subtleforms'] ?? 0 ) !== self::VERSION ) {
			return array(
				'submissions' => array(),
				'error'       => __( 'This file is not a SubtleForms submissions export.', 'subtleforms' ),
			);
		}
		$rows = $package['submissions'] ?? null;
		if ( ! is_array( $rows ) || ! $rows ) {
			return array(
				'submissions' => array(),
				'error'       => __( 'The export does not contain any submissions.', 'subtleforms' ),
			);
		}
		if ( count( $rows ) > self::MAX_SUBMISSIONS ) {
			return array(
				'submissions' => array(),
				'error'       => sprintf(
					/* translators: %d: maximum number of submissions */
					__( 'Import up to %d submissions at a time.', 'subtleforms' ),
					self::MAX_SUBMISSIONS
				),
			);
		}
		$clean = array();
		foreach ( $rows as $row ) {
			if ( ! is_array( $row ) || ! is_array( $row['payload'] ?? null ) ) {
				continue;
			}
			$clean[] = array(
				'status'     => self::status( (string) ( $row['status'] ?? 'unread' ) ),
				'created_at' => self::timestamp( (string) ( $row['created_at'] ?? '' ) ),
				'payload'    => $row['payload'],
			);
		}
		if ( ! $clean ) {
			return array(
				'submissions' => array(),
				'error'       => __( 'None of the submissions in this file could be read.', 'subtleforms' ),
			);
		}
		return array(
			'submissions' => $clean,
			'error'       => '',
		);
	}

	/**
	 * Remove secret answers. The keys are the form's password fields.
	 *
	 * @param array    $payload Stored answers.
	 * @param string[] $secretKeys Field keys.
	 * @return array
	 */
	public static function withoutSecrets( array $payload, array $secretKeys ): array {
		foreach ( $secretKeys as $key ) {
			unset( $payload[ $key ] );
		}
		return $payload;
	}

	/**
	 * A short title.
	 *
	 * @param string $title Raw title.
	 * @return string
	 */
	public static function title( string $title ): string {
		$title = trim( (string) preg_replace( '/<[^>]*>/', '', $title ) );
		if ( function_exists( 'mb_substr' ) ) {
			$title = mb_substr( $title, 0, 200 );
		} else {
			$title = substr( $title, 0, 200 );
		}
		return '' !== $title ? $title : __( 'Imported form', 'subtleforms' );
	}

	/**
	 * A status we will store. Trash is never imported.
	 *
	 * @param string $status Raw status.
	 * @return string
	 */
	public static function status( string $status ): string {
		$allowed = array( 'unread', 'read', 'completed', 'saved', 'flagged', 'payment_pending' );
		return in_array( $status, $allowed, true ) ? $status : 'unread';
	}

	/**
	 * A UTC timestamp, or an empty string when it is not one.
	 *
	 * @param string $value Raw time.
	 * @return string
	 */
	public static function timestamp( string $value ): string {
		$value = trim( $value );
		if ( preg_match( '/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/', $value ) ) {
			return substr( str_replace( 'T', ' ', $value ), 0, 19 );
		}
		return '';
	}
}
