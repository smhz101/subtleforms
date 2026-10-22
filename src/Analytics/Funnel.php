<?php
/**
 * Form completion funnel: where visitors stop filling in a form.
 *
 * Daily totals per form in `{prefix}subtleforms_funnel`, one row per form,
 * day (UTC), metric and field key. Nothing that identifies a visitor is
 * stored: no address, no cookie, no answer. A visitor who starts a form and
 * leaves without sending it adds one to the field they touched last (and to
 * the step they were on, for a multi-step form).
 *
 * The funnel reads three numbers that already exist instead of counting them
 * twice: views come from Stats (the view beacon), submissions from the real
 * entries, and "started" is everyone who either sent the form or left it.
 *
 * Tracking follows the analytics switches in Settings > Integrations >
 * Analytics: no view counting means no funnel either.
 *
 * @package SubtleForms\Analytics
 * @since   2.6.0
 */

namespace SubtleForms\Analytics;

use SubtleForms\Support\FieldMapper;
use SubtleForms\Support\Settings;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Funnel store and hooks.
 */
final class Funnel {

	/** Option holding the installed table version. */
	const DB_OPTION = 'subtleforms_funnel_db';

	/** Current table version. */
	const DB_VERSION = '1';

	/** A visitor left at a field. */
	const METRIC_DROP = 'drop';

	/** A visitor left on a step of a multi-step form. */
	const METRIC_DROP_STEP = 'drop_step';

	/** Setting that holds how many days of funnel totals are kept. */
	const RETENTION_SETTING = 'ext_analytics_funnel_retention_days';

	/** Default retention, in days. */
	const RETENTION_DEFAULT = 180;

	/** Longest field key that is stored. */
	const MAX_KEY_LENGTH = 100;

	/** Highest step index that is stored. */
	const MAX_STEP = 99;

	/**
	 * Register hooks. Called once from Plugin::init().
	 */
	public static function register(): void {
		add_action( 'init', array( __CLASS__, 'maybeInstall' ), 5 );
		// Pruned by the daily analytics event, so no new cron is added.
		add_action( Stats::PRUNE_HOOK, array( __CLASS__, 'prune' ) );
		add_action( 'rest_api_init', array( __CLASS__, 'registerRoutes' ) );
	}

	/**
	 * Register the REST routes.
	 */
	public static function registerRoutes(): void {
		( new \SubtleForms\Api\FunnelApi() )->registerRoutes();
	}

	/**
	 * Table name.
	 */
	public static function table(): string {
		global $wpdb;
		return $wpdb->prefix . 'subtleforms_funnel';
	}

	/**
	 * Create or upgrade the table.
	 */
	public static function maybeInstall(): void {
		if ( get_option( self::DB_OPTION ) === self::DB_VERSION ) {
			return;
		}

		global $wpdb;
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';

		$table   = self::table();
		$charset = $wpdb->get_charset_collate();

		dbDelta(
			"CREATE TABLE {$table} (
  form_id bigint(20) unsigned NOT NULL,
  day date NOT NULL,
  metric varchar(20) NOT NULL,
  field_key varchar(100) NOT NULL DEFAULT '',
  count int(11) unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY  (form_id,day,metric,field_key),
  KEY day (day)
) {$charset};"
		);

		update_option( self::DB_OPTION, self::DB_VERSION, false );
	}

	/**
	 * Whether the funnel is recorded. The view counting switch is the master
	 * switch: the funnel needs the views to mean anything.
	 *
	 * @param Settings|null $settings Settings instance.
	 */
	public static function tracks( ?Settings $settings = null ): bool {
		$enabled = Stats::tracksViews( $settings );

		/**
		 * Filter whether SubtleForms records where visitors stop filling in
		 * a form.
		 *
		 * @param bool $enabled Whether the funnel is recorded.
		 * @since 2.6.0
		 */
		return (bool) apply_filters( 'subtleforms/analytics/track_funnel', $enabled );
	}

	/**
	 * Whether the current visitor is left out: people who manage SubtleForms
	 * test their own forms and would skew the numbers.
	 */
	public static function skipsCurrentUser(): bool {
		return is_user_logged_in() && current_user_can( ( new \SubtleForms\Support\Capabilities() )->manage_cap() );
	}

	/**
	 * Whether a user agent looks like a robot (a basic check, the browser
	 * makes the same one).
	 *
	 * @param string $agent User agent.
	 */
	public static function isBot( string $agent ): bool {
		if ( '' === trim( $agent ) ) {
			return true;
		}
		return 1 === preg_match( '/bot|crawl|spider|slurp|headless|lighthouse|pingdom|facebookexternalhit|preview/i', $agent );
	}

	/**
	 * Answerable fields of a schema, key => label, in form order.
	 *
	 * @param array|null $schema Form schema.
	 * @return array<string,string>
	 */
	public static function fieldLabels( $schema ): array {
		return array_map(
			static function ( $info ) {
				return $info['label'];
			},
			self::fieldInfo( $schema )
		);
	}

	/**
	 * Answerable fields of a schema with their label and type, in form order.
	 *
	 * @param array|null $schema Form schema.
	 * @return array<string,array{label:string,type:string}>
	 */
	public static function fieldInfo( $schema ): array {
		if ( ! is_array( $schema ) ) {
			return array();
		}
		$out = array();
		foreach ( FieldMapper::fields( $schema ) as $field ) {
			$key = (string) $field['key'];
			if ( '' === $key || isset( $out[ $key ] ) ) {
				continue;
			}
			$label       = trim( wp_strip_all_tags( (string) ( $field['public_label'] ?? '' ) ) );
			$out[ $key ] = array(
				'label' => '' !== $label ? $label : $key,
				'type'  => (string) ( $field['type'] ?? '' ),
			);
		}
		return $out;
	}

	/**
	 * Labels of explicit steps, by index.
	 *
	 * @param array|null $schema Form schema.
	 * @return array<int,string>
	 */
	public static function stepLabels( $schema ): array {
		$out = array();
		if ( ! is_array( $schema ) || empty( $schema['fields'] ) || ! is_array( $schema['fields'] ) ) {
			return $out;
		}
		$index = 0;
		foreach ( $schema['fields'] as $node ) {
			if ( ! is_array( $node ) || 'step' !== ( $node['type'] ?? '' ) ) {
				continue;
			}
			$label         = (string) ( $node['config']['label'] ?? ( $node['label'] ?? '' ) );
			$out[ $index ] = trim( wp_strip_all_tags( $label ) );
			++$index;
		}
		return $out;
	}

	/**
	 * Keep a field key only when the published form has it.
	 *
	 * @param mixed                $key    Key from the browser.
	 * @param array<string,string> $fields Known fields.
	 * @return string The key, or '' for a missing or unknown one.
	 */
	public static function knownKey( $key, array $fields ): string {
		if ( ! is_string( $key ) || '' === $key || strlen( $key ) > self::MAX_KEY_LENGTH ) {
			return '';
		}
		return isset( $fields[ $key ] ) ? $key : '';
	}

	/**
	 * A step index from the browser, or -1 when there is none.
	 *
	 * @param mixed $step Step index.
	 */
	public static function stepIndex( $step ): int {
		if ( is_int( $step ) ) {
			$value = $step;
		} elseif ( is_string( $step ) && 1 === preg_match( '/^\d{1,2}$/', $step ) ) {
			$value = (int) $step;
		} else {
			return -1;
		}
		return ( $value >= 0 && $value <= self::MAX_STEP ) ? $value : -1;
	}

	/**
	 * Record that a visitor left the form.
	 *
	 * @param int    $formId Form ID.
	 * @param string $key    Last field touched ('' when unknown).
	 * @param int    $step   Step index, or -1.
	 * @param string $day    Y-m-d (UTC). Defaults to today.
	 */
	public static function recordDrop( int $formId, string $key, int $step, string $day = '' ): void {
		self::adjust( $formId, self::METRIC_DROP, $key, 1, $day );
		if ( $step >= 0 ) {
			self::adjust( $formId, self::METRIC_DROP_STEP, (string) $step, 1, $day );
		}
	}

	/**
	 * Take back a drop reported earlier on the same page: the visitor came
	 * back and sent the form, or left again somewhere else.
	 *
	 * @param int    $formId Form ID.
	 * @param string $key    Field reported before.
	 * @param int    $step   Step reported before, or -1.
	 * @param string $day    Y-m-d (UTC). Defaults to today.
	 */
	public static function undoDrop( int $formId, string $key, int $step, string $day = '' ): void {
		self::adjust( $formId, self::METRIC_DROP, $key, -1, $day );
		if ( $step >= 0 ) {
			self::adjust( $formId, self::METRIC_DROP_STEP, (string) $step, -1, $day );
		}
	}

	/**
	 * Change one daily counter. A counter never goes below zero.
	 *
	 * @param int    $formId Form ID.
	 * @param string $metric Metric name.
	 * @param string $key    Field key or step index.
	 * @param int    $delta  +1 or -1.
	 * @param string $day    Y-m-d (UTC). Defaults to today.
	 */
	public static function adjust( int $formId, string $metric, string $key, int $delta, string $day = '' ): bool {
		if ( $formId <= 0 || 0 === $delta || ! in_array( $metric, array( self::METRIC_DROP, self::METRIC_DROP_STEP ), true ) ) {
			return false;
		}

		self::maybeInstall();

		global $wpdb;
		$table = self::table();
		$day   = '' !== $day ? $day : gmdate( 'Y-m-d' );
		$key   = substr( $key, 0, self::MAX_KEY_LENGTH );

		// phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter -- Fixed table name; prepared values; counters must not be cached.
		if ( $delta < 0 ) {
			return (bool) $wpdb->query( $wpdb->prepare( "UPDATE {$table} SET count = count - 1 WHERE form_id = %d AND day = %s AND metric = %s AND field_key = %s AND count > 0", $formId, $day, $metric, $key ) );
		}

		// UPDATE, then INSERT IGNORE + UPDATE when the row is new: atomic on
		// MySQL and works on SQLite (the same pattern as Stats::increment()).
		$updated = $wpdb->query( $wpdb->prepare( "UPDATE {$table} SET count = count + 1 WHERE form_id = %d AND day = %s AND metric = %s AND field_key = %s", $formId, $day, $metric, $key ) );
		if ( ! $updated ) {
			$wpdb->query( $wpdb->prepare( "INSERT IGNORE INTO {$table} (form_id, day, metric, field_key, count) VALUES (%d, %s, %s, %s, 0)", $formId, $day, $metric, $key ) );
			$updated = $wpdb->query( $wpdb->prepare( "UPDATE {$table} SET count = count + 1 WHERE form_id = %d AND day = %s AND metric = %s AND field_key = %s", $formId, $day, $metric, $key ) );
		}
		// phpcs:enable

		return (bool) $updated;
	}

	/**
	 * Drop totals per key for one metric over the last N days.
	 *
	 * @param int    $formId Form ID.
	 * @param string $metric Metric.
	 * @param int    $days   Days.
	 * @return array<string,int> Key => count, largest first.
	 */
	public static function totals( int $formId, string $metric, int $days ): array {
		global $wpdb;
		$table = self::table();
		self::maybeInstall();
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter -- Fixed table name; prepared values; report data changes every request.
		$rows = $wpdb->get_results( $wpdb->prepare( "SELECT field_key, SUM(count) AS total FROM {$table} WHERE form_id = %d AND metric = %s AND day >= %s GROUP BY field_key", $formId, $metric, Stats::since( $days ) ), ARRAY_A );

		$out = array();
		foreach ( (array) $rows as $row ) {
			$total = (int) $row['total'];
			if ( $total > 0 ) {
				$out[ (string) $row['field_key'] ] = $total;
			}
		}
		arsort( $out );
		return $out;
	}

	/**
	 * Visitors who left without sending, per form, over the last N days.
	 *
	 * @param int $days Days.
	 * @return array<int,int> Form ID => count.
	 */
	public static function dropsByForm( int $days ): array {
		global $wpdb;
		$table = self::table();
		self::maybeInstall();
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter -- Fixed table name; prepared values; report data changes every request.
		$rows = $wpdb->get_results( $wpdb->prepare( "SELECT form_id, SUM(count) AS total FROM {$table} WHERE metric = %s AND day >= %s GROUP BY form_id", self::METRIC_DROP, Stats::since( $days ) ), ARRAY_A );

		$out = array();
		foreach ( (array) $rows as $row ) {
			$out[ (int) $row['form_id'] ] = (int) $row['total'];
		}
		return $out;
	}

	/**
	 * Real entries for a form over the last N days. Spam, failed, preview and
	 * trashed entries are not counted.
	 *
	 * @param int $formId Form ID.
	 * @param int $days   Days.
	 */
	public static function submissions( int $formId, int $days ): int {
		global $wpdb;
		$table   = $wpdb->prefix . 'subtleforms_submissions';
		$counted = Stats::COUNTED_STATUSES;
		$in      = implode( ',', array_fill( 0, count( $counted ), '%s' ) );
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare -- Fixed table name; prepared values; report data changes every request.
		return (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$table} WHERE form_id = %d AND created_at >= %s AND status IN ({$in})", array_merge( array( $formId, Stats::since( $days ) . ' 00:00:00' ), $counted ) ) );
	}

	/**
	 * The funnel report for one form.
	 *
	 * @param int        $formId Form ID.
	 * @param int        $days   Days.
	 * @param array|null $schema Published schema, for field and step names.
	 * @return array{seen:int,started:int,submitted:int,left:int,fields:array,steps:array}
	 */
	public static function report( int $formId, int $days, $schema = null ): array {
		$days      = max( 1, min( Stats::MAX_DAYS, $days ) );
		$series    = Stats::series( $days, $formId );
		$seen      = (int) array_sum( array_column( $series, 'views' ) );
		$submitted = self::submissions( $formId, $days );
		$drops     = self::totals( $formId, self::METRIC_DROP, $days );
		$left      = (int) array_sum( $drops );
		$info      = self::fieldInfo( $schema );
		$stepNames = self::stepLabels( $schema );

		$fields = array();
		foreach ( $drops as $key => $count ) {
			$key      = (string) $key;
			$fields[] = array(
				'key'   => $key,
				// A field removed from the form since, or a drop with no field.
				'label' => '' === $key ? '' : ( $info[ $key ]['label'] ?? $key ),
				'type'  => $info[ $key ]['type'] ?? '',
				'count' => $count,
				'known' => '' !== $key && isset( $info[ $key ] ),
			);
		}

		$steps = array();
		foreach ( self::totals( $formId, self::METRIC_DROP_STEP, $days ) as $index => $count ) {
			$index   = (int) $index;
			$steps[] = array(
				'index' => $index,
				'label' => $stepNames[ $index ] ?? '',
				'count' => $count,
			);
		}

		return array(
			'seen'      => $seen,
			// Everyone who sent the form or left it after starting.
			'started'   => $left + $submitted,
			'submitted' => $submitted,
			'left'      => $left,
			'fields'    => $fields,
			'steps'     => $steps,
		);
	}

	/**
	 * Retention in days.
	 *
	 * @param Settings|null $settings Settings instance.
	 */
	public static function retentionDays( ?Settings $settings = null ): int {
		$settings = $settings ?? new Settings();
		$days     = (int) $settings->get( self::RETENTION_SETTING, self::RETENTION_DEFAULT );
		return $days > 0 ? min( 3650, $days ) : self::RETENTION_DEFAULT;
	}

	/**
	 * Delete rows older than the retention period.
	 */
	public static function prune(): void {
		$days = self::retentionDays();
		self::maybeInstall();

		global $wpdb;
		$table = self::table();
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter -- Fixed table name; prepared value; maintenance query.
		$wpdb->query( $wpdb->prepare( "DELETE FROM {$table} WHERE day < %s", gmdate( 'Y-m-d', time() - ( $days - 1 ) * DAY_IN_SECONDS ) ) );
	}
}
