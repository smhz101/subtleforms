<?php

/**
 * Single source of truth for a form's type and status.
 *
 * @package   SubtleForms\Support
 * @version   1.9.5
 * @since     1.9.5
 */

namespace SubtleForms\Support;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Canonical form type and status helpers.
 *
 * The Dashboard, All Forms, builder header and block picker each used to
 * derive a form's type and status from different fields (form_type vs
 * metadata.type vs draftSchema.metadata.type), which made the same form show
 * different values on different screens. This class centralises that logic.
 */
final class FormMeta {

	/**
	 * Canonical form types.
	 */
	const TYPE_STANDARD     = 'regular';
	const TYPE_MULTI_STEP   = 'multi-step';
	const TYPE_CONVERSATIONAL = 'conversational';

	/**
	 * Canonical form statuses.
	 */
	const STATUS_DRAFT     = 'draft';
	const STATUS_PUBLISHED = 'published';
	const STATUS_ARCHIVED  = 'archived';
	const STATUS_TRASH     = 'trash';

	/**
	 * Normalise a raw form type to a canonical value.
	 *
	 * Legacy/alias types are mapped to their canonical equivalent. Unknown
	 * types fall back to "regular" (Standard) so a payment or custom type
	 * still renders a sensible badge instead of an empty one.
	 *
	 * @param string|null $raw Raw type from schema metadata or the form_type column.
	 * @return string Canonical type constant.
	 */
	public static function normalize_type( ?string $raw ): string {
		if ( $raw === null || $raw === '' ) {
			return self::TYPE_STANDARD;
		}

		$raw = strtolower( $raw );

		if ( $raw === 'multistep' || $raw === 'sectioned' || $raw === 'multi-step' || $raw === 'multi_step' ) {
			return self::TYPE_MULTI_STEP;
		}

		if ( $raw === 'conversational' ) {
			return self::TYPE_CONVERSATIONAL;
		}

		// 'regular', 'standard', 'payment' and anything else render as Standard.
		return self::TYPE_STANDARD;
	}

	/**
	 * Normalise a raw status to a canonical value.
	 *
	 * @param string|null $raw Raw status from the forms table.
	 * @return string Canonical status constant.
	 */
	public static function normalize_status( ?string $raw ): string {
		if ( $raw === null || $raw === '' ) {
			return self::STATUS_DRAFT;
		}

		$raw = strtolower( $raw );

		if ( $raw === self::STATUS_PUBLISHED ) {
			return self::STATUS_PUBLISHED;
		}
		if ( $raw === self::STATUS_ARCHIVED ) {
			return self::STATUS_ARCHIVED;
		}
		// A trashed form stays "trash" so lists show it as Trashed and offer
		// Restore and Delete permanently (QA-11).
		if ( $raw === self::STATUS_TRASH ) {
			return self::STATUS_TRASH;
		}

		return self::STATUS_DRAFT;
	}

	/**
	 * Resolve the canonical type for a form row.
	 *
	 * Prefers the server-extracted `form_type` column (which itself prefers
	 * the in-progress draft over the published config), then falls back to
	 * any metadata.type present on the row, then to the published config.
	 *
	 * @param array $form Form row (may come from the list or single-form endpoint).
	 * @return string Canonical type constant.
	 */
	public static function type( array $form ): string {
		$raw = $form['form_type'] ?? null;

		if ( empty( $raw ) ) {
			// Some payloads (e.g. dashboard recent forms pre-1.9.5, or cached
			// responses) only carry metadata. Use it if present.
			$raw = $form['metadata']['type'] ?? null;
		}

		if ( empty( $raw ) && isset( $form['config'] ) && is_array( $form['config'] ) ) {
			$raw = $form['config']['metadata']['type'] ?? null;
		}

		return self::normalize_type( is_string( $raw ) ? $raw : null );
	}

	/**
	 * Resolve the canonical status for a form row.
	 *
	 * @param array $form Form row.
	 * @return string Canonical status constant.
	 */
	public static function status( array $form ): string {
		return self::normalize_status( isset( $form['status'] ) && is_string( $form['status'] ) ? $form['status'] : null );
	}

	/**
	 * Whether a published form has unpublished draft changes.
	 *
	 * Compares the in-progress draft_schema against the published config.
	 * Draft forms always report false (they are not published, so the
	 * "unpublished changes" nuance does not apply, they are simply drafts).
	 *
	 * @param array $form Form row with raw draft_schema and config available.
	 * @return bool
	 */
	public static function has_unpublished_changes( array $form ): bool {
		if ( self::status( $form ) !== self::STATUS_PUBLISHED ) {
			return false;
		}

		// If the caller (e.g. the list SQL) already computed the flag, trust it.
		if ( array_key_exists( 'has_unpublished_changes', $form ) ) {
			return (bool) $form['has_unpublished_changes'];
		}

		$draft_raw = array_key_exists( 'draft_schema', $form ) ? $form['draft_schema'] : null;
		$config_raw = array_key_exists( 'config', $form ) ? $form['config'] : null;

		// `find()` decodes config into an array; `all()` leaves both as raw
		// strings. Normalise to raw strings for a byte-level comparison.
		if ( is_array( $config_raw ) ) {
			$config_raw = wp_json_encode( $config_raw );
		}
		if ( is_array( $draft_raw ) ) {
			$draft_raw = wp_json_encode( $draft_raw );
		}

		$draft_raw  = is_string( $draft_raw ) ? trim( $draft_raw ) : '';
		$config_raw = is_string( $config_raw ) ? trim( $config_raw ) : '';

		if ( $draft_raw === '' || $config_raw === '' ) {
			return false;
		}

		return $draft_raw !== $config_raw;
	}

	/**
	 * Attach canonical type, status and has_unpublished_changes to a form row.
	 *
	 * Intended for API response shaping so every consumer reads the same
	 * fields (`type`, `status`, `has_unpublished_changes`) regardless of the
	 * underlying storage shape.
	 *
	 * @param array $form Form row.
	 * @return array Form row with canonical meta added.
	 */
	public static function with_meta( array $form ): array {
		$form['type']                    = self::type( $form );
		$form['status']                   = self::status( $form );
		$form['has_unpublished_changes']  = self::has_unpublished_changes( $form );

		return $form;
	}
}
