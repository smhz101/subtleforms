<?php
/**
 * Extension points that add-ons build features on.
 *
 * Some features are not part of this plugin: picture choice fields, several
 * files per upload field, advanced conditional logic and form analytics. The
 * plugin ships only the hooks an add-on needs to provide them (documented in
 * docs/hooks.md) and a plain fallback for forms that already use them. An
 * add-on asks here which hooks the installed version has, so it never adds a
 * feature that an older version of this plugin still ships itself.
 *
 * @package SubtleForms\Support
 * @since   2.7.0
 */

namespace SubtleForms\Support;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class ExtensionPoints {

	/**
	 * Version of the extension point contract. Raised on every breaking change
	 * to a hook, a class constant or a method an add-on uses. Add-ons check it
	 * with an exact or range match and refuse to run outside that range.
	 *
	 * 2: logic, upload and add-on feature hooks of 2.7.0; FeatureGate setters.
	 * 3: the submission store hooks (before_store, after_store,
	 *    store_abandoned) replace price_order and finish_order; answer format,
	 *    webhook group, request key, public route and no-answer type filters;
	 *    the JavaScript form wrapper, option attribute and payload group
	 *    registries. Free no longer exports `contexts` or `pricing`.
	 */
	public const LEVEL = 3;

	/** Field types that an add-on registers with its own renderer, controls and checks. */
	public const PICTURE_CHOICE = 'picture_choice';

	/** More than one file per upload field. */
	public const MULTI_FILE_UPLOADS = 'multi_file_uploads';

	/** Condition groups, the "any" match, extra operators and conditions on steps, actions and confirmations. */
	public const ADVANCED_LOGIC = 'advanced_logic';

	/** Views, conversion and the form funnel: counting, storage, routes and report screens. */
	public const ANALYTICS = 'analytics';

	/**
	 * Every extension point this version provides.
	 *
	 * @return string[]
	 */
	public static function all(): array {
		return array(
			self::PICTURE_CHOICE,
			self::MULTI_FILE_UPLOADS,
			self::ADVANCED_LOGIC,
			self::ANALYTICS,
		);
	}

	/**
	 * Whether this version provides an extension point (and so no longer
	 * ships the feature itself).
	 *
	 * @param string $point One of the constants above.
	 */
	public static function has( string $point ): bool {
		return in_array( $point, self::all(), true );
	}

	/**
	 * The extension points an add-on provides right now.
	 *
	 * @return string[]
	 */
	public static function provided(): array {
		/**
		 * Which extension points an active add-on provides. An add-on
		 * adds the names of the features it runs, so the builder can tell
		 * "this form uses a feature that is not active" from "it is".
		 *
		 * @param string[] $features Names from ExtensionPoints::all(). Default none.
		 * @since 2.7.0
		 */
		$features = apply_filters( 'subtleforms/addon/features', array() );
		return array_values( array_intersect( self::all(), is_array( $features ) ? array_map( 'strval', $features ) : array() ) );
	}

	/**
	 * Whether an add-on provides an extension point right now.
	 *
	 * @param string $point One of the constants above.
	 */
	public static function isProvided( string $point ): bool {
		return in_array( $point, self::provided(), true );
	}
}
