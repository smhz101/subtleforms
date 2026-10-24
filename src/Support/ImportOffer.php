<?php
/**
 * Fresh-install offer to import forms from other form plugins.
 *
 * When SubtleForms has no forms yet and another plugin left forms on the site,
 * the admin shows a one-time modal, then a dismissible notice if the modal is
 * closed without importing.
 *
 * @package SubtleForms\Support
 * @since   2.7.2
 */

namespace SubtleForms\Support;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use SubtleForms\Repositories\FormsRepository;
use SubtleForms\Tools\Import\Importer;

/**
 * Option state and source detection for the import offer.
 */
final class ImportOffer {

	/**
	 * Offer state: none (not eligible / not yet evaluated), pending (show
	 * modal), notice (modal closed; show banner), dismissed.
	 */
	const OPTION = 'subtleforms_import_offer';

	/** Source ids that Site Import can actually migrate. */
	const IMPORTABLE = array( 'cf7', 'gravity', 'fluent' );

	/**
	 * Unit-test override for formsCount(). Null uses the live count.
	 *
	 * @var int|null
	 */
	public static $testFormsCount = null;

	/**
	 * Unit-test override for sourcesWithForms(). Null uses detection.
	 *
	 * @var array|null
	 */
	public static $testSources = null;

	/**
	 * Register hooks. Called once from Plugin::init().
	 */
	public static function register(): void {
		add_action( 'init', array( __CLASS__, 'maybeEvaluate' ), 7 );
	}

	/**
	 * Sites that skipped activation still get a state when the option is absent.
	 */
	public static function maybeEvaluate(): void {
		if ( false !== get_option( self::OPTION ) ) {
			return;
		}
		if ( false === get_option( 'subtleforms_db_version' ) ) {
			return;
		}
		self::evaluateAndStore();
	}

	/**
	 * After activation: set pending when the site is empty and sources exist.
	 *
	 * @param bool $fresh Unused; eligibility is based on form counts.
	 */
	public static function afterActivate( bool $fresh ): void { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.Found
		if ( false !== get_option( self::OPTION ) ) {
			return;
		}
		self::evaluateAndStore();
	}

	/**
	 * Detect sources, then store pending or none.
	 */
	public static function evaluateAndStore(): void {
		update_option( self::OPTION, self::isEligible() ? 'pending' : 'none', true );
	}

	/**
	 * Empty SubtleForms site with at least one other plugin form.
	 */
	public static function isEligible(): bool {
		return 0 === self::formsCount() && count( self::sourcesWithForms() ) > 0;
	}

	/**
	 * What the admin UI shows.
	 *
	 * @return array{offer: string|null, sources: array<int, array>, labels: string[]}
	 */
	public static function status(): array {
		$state = get_option( self::OPTION );
		if ( false === $state || 'none' === $state ) {
			if ( self::isEligible() ) {
				update_option( self::OPTION, 'pending', true );
				$state = 'pending';
			} else {
				if ( false === $state ) {
					update_option( self::OPTION, 'none', true );
				}
				return self::emptyStatus();
			}
		}

		if ( 'dismissed' === $state ) {
			return self::emptyStatus();
		}

		if ( ! self::isEligible() ) {
			return self::emptyStatus();
		}

		$sources = self::sourcesWithForms();
		$labels  = array_values(
			array_map(
				static function ( array $row ): string {
					return (string) $row['label'];
				},
				$sources
			)
		);

		$offer = null;
		if ( 'pending' === $state ) {
			$offer = 'modal';
		} elseif ( 'notice' === $state ) {
			$offer = 'notice';
		}

		return array(
			'offer'   => $offer,
			'sources' => $sources,
			'labels'  => $labels,
		);
	}

	/**
	 * Modal closed without importing: show the notice next.
	 */
	public static function defer(): void {
		update_option( self::OPTION, 'notice', true );
	}

	/**
	 * Hide the offer for good.
	 */
	public static function dismiss(): void {
		update_option( self::OPTION, 'dismissed', true );
	}

	/**
	 * @return array{offer: null, sources: array, labels: array}
	 */
	private static function emptyStatus(): array {
		return array(
			'offer'   => null,
			'sources' => array(),
			'labels'  => array(),
		);
	}

	/**
	 * SubtleForms forms that are not in the trash.
	 */
	public static function formsCount(): int {
		if ( null !== self::$testFormsCount ) {
			return max( 0, (int) self::$testFormsCount );
		}

		/**
		 * Filter the SubtleForms form count used by the import offer.
		 *
		 * @since 2.7.2
		 *
		 * @param int|null $count Null to use the repository count.
		 */
		$filtered = apply_filters( 'subtleforms/import_offer/forms_count', null );
		if ( is_int( $filtered ) ) {
			return max( 0, $filtered );
		}

		try {
			return ( new FormsRepository() )->count();
		} catch ( \Throwable $e ) {
			return self::formsCountDirect();
		}
	}

	/**
	 * Direct count when the repository cannot boot (missing tables).
	 */
	private static function formsCountDirect(): int {
		global $wpdb;
		$table = $wpdb->prefix . 'subtleforms_forms';
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Existence check.
		$found = $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $wpdb->esc_like( $table ) ) );
		if ( $found !== $table ) {
			return 0;
		}
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Fixed table name.
		return (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$table} WHERE status <> 'trash'" );
	}

	/**
	 * Detected sources that still have forms, with can_import flags.
	 *
	 * @return array<int, array{id: string, label: string, active: bool, count: int, can_import: bool}>
	 */
	public static function sourcesWithForms(): array {
		if ( is_array( self::$testSources ) ) {
			return array_values( self::$testSources );
		}

		$sources = array_values(
			array_filter(
				self::detectSources(),
				static function ( array $row ): bool {
					return (int) ( $row['count'] ?? 0 ) > 0;
				}
			)
		);

		/**
		 * Filter the import-offer source list (after empty counts are dropped).
		 *
		 * @since 2.7.2
		 *
		 * @param array $sources Sources with forms.
		 */
		$filtered = apply_filters( 'subtleforms/import_offer/sources', $sources );
		return is_array( $filtered ) ? array_values( $filtered ) : $sources;
	}

	/**
	 * Every watched plugin with how many forms it left.
	 *
	 * @return array<int, array{id: string, label: string, active: bool, count: int, can_import: bool}>
	 */
	public static function detectSources(): array {
		$out = array();

		try {
			$importer = new Importer( new FormsRepository() );
			foreach ( $importer->detect() as $row ) {
				$id    = (string) ( $row['id'] ?? '' );
				$out[] = array(
					'id'         => $id,
					'label'      => (string) ( $row['label'] ?? $id ),
					'active'     => (bool) ( $row['active'] ?? false ),
					'count'      => (int) ( $row['count'] ?? 0 ),
					'can_import' => in_array( $id, self::IMPORTABLE, true ),
				);
			}
		} catch ( \Throwable $e ) {
			// Tables missing or a source threw; fall through to lightweight detectors.
		}

		foreach ( self::extraDetectors() as $row ) {
			$id     = $row['id'];
			$exists = false;
			foreach ( $out as $existing ) {
				if ( $existing['id'] === $id ) {
					$exists = true;
					break;
				}
			}
			if ( ! $exists ) {
				$out[] = $row;
			}
		}

		/**
		 * Filter raw detection before empty sources are removed.
		 *
		 * @since 2.7.2
		 *
		 * @param array $out Detected sources.
		 */
		$filtered = apply_filters( 'subtleforms/import_offer/detect', $out );
		return is_array( $filtered ) ? $filtered : $out;
	}

	/**
	 * Lightweight detectors for plugins Site Import cannot migrate yet.
	 *
	 * @return array<int, array{id: string, label: string, active: bool, count: int, can_import: bool}>
	 */
	private static function extraDetectors(): array {
		return array(
			self::postTypeSource(
				'wpforms',
				__( 'WPForms', 'subtleforms' ),
				'wpforms',
				class_exists( 'WPForms', false )
					|| defined( 'WPFORMS_VERSION' )
					|| function_exists( 'wpforms' )
			),
			self::postTypeSource(
				'forminator',
				__( 'Forminator', 'subtleforms' ),
				'forminator_forms',
				class_exists( 'Forminator', false ) || defined( 'FORMINATOR_VERSION' )
			),
			self::sureFormsSource(),
		);
	}

	/**
	 * Count published-like posts of a form CPT.
	 *
	 * @param string $id       Source id.
	 * @param string $label    Label.
	 * @param string $postType Post type.
	 * @param bool   $active   Whether the plugin looks active.
	 * @return array{id: string, label: string, active: bool, count: int, can_import: bool}
	 */
	private static function postTypeSource( string $id, string $label, string $postType, bool $active ): array {
		return array(
			'id'         => $id,
			'label'      => $label,
			'active'     => $active,
			'count'      => self::countPosts( $postType ),
			'can_import' => false,
		);
	}

	/**
	 * SureForms (Brainstorm Force): probe known constants and CPTs.
	 *
	 * @return array{id: string, label: string, active: bool, count: int, can_import: bool}
	 */
	private static function sureFormsSource(): array {
		$active = defined( 'SRFM_VER' )
			|| class_exists( 'SureForms', false )
			|| class_exists( '\SRFM\Plugin', false );
		$count  = 0;
		foreach ( array( 'sureforms_form', 'srfm_form' ) as $post_type ) {
			$n = self::countPosts( $post_type );
			if ( $n > $count ) {
				$count = $n;
			}
		}
		return array(
			'id'         => 'sureforms',
			'label'      => __( 'SureForms', 'subtleforms' ),
			'active'     => $active,
			'count'      => $count,
			'can_import' => false,
		);
	}

	/**
	 * Safe post count; 0 when the type or table is missing.
	 *
	 * @param string $postType Post type.
	 */
	private static function countPosts( string $postType ): int {
		global $wpdb;
		if ( ! isset( $wpdb ) || ! is_object( $wpdb ) || empty( $wpdb->posts ) ) {
			return 0;
		}
		try {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Admin offer; other plugin's CPT.
			return (int) $wpdb->get_var(
				$wpdb->prepare(
					"SELECT COUNT(*) FROM {$wpdb->posts} WHERE post_type = %s AND post_status NOT IN ('trash','auto-draft')",
					$postType
				)
			);
		} catch ( \Throwable $e ) {
			return 0;
		}
	}
}
