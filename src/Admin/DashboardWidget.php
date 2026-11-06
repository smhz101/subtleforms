<?php
/**
 * The SubtleForms box on the WordPress dashboard (Dashboard > Home).
 *
 * Drawn in PHP, with a small inline SVG for the week, so it needs no script
 * and appears with the page. The figures are kept for five minutes; a new or
 * changed entry ends the wait because the key carries the entries generation.
 *
 * @package SubtleForms\Admin
 * @since   2.7.5
 */

namespace SubtleForms\Admin;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use SubtleForms\Repositories\FormsRepository;
use SubtleForms\Support\Capabilities;
use SubtleForms\Tools\ReportQueries;
use SubtleForms\Tools\ReportSeries;

/**
 * Dashboard widget.
 */
final class DashboardWidget {

	/** Widget id. */
	public const ID = 'subtleforms_overview';

	/** Seconds the figures are kept. */
	public const TTL = 300;

	/**
	 * Hook in.
	 */
	public static function register(): void {
		add_action( 'wp_dashboard_setup', array( self::class, 'add' ) );
	}

	/**
	 * Add the widget for people who can see entries.
	 */
	public static function add(): void {
		if ( ! current_user_can( ( new Capabilities() )->manage_cap() ) ) {
			return;
		}
		wp_add_dashboard_widget(
			self::ID,
			esc_html( (string) ( AdminMenu::branding()['name'] ?? 'SubtleForms' ) ),
			array( self::class, 'render' )
		);
	}

	/**
	 * The figures: entries over the last 7 days (per day), unread entries, the
	 * three forms with the most entries this week, and how many forms exist.
	 *
	 * @return array{forms:int,week:int,days:int[],unread:int,top:array<int,array{id:int,title:string,entries:int}>}
	 */
	public static function data(): array {
		$key    = OverviewData::cacheKey( 'widget' );
		$cached = get_transient( $key );
		if ( is_array( $cached ) ) {
			return $cached;
		}
		$forms    = new FormsRepository();
		$zone     = ReportSeries::siteZone();
		$today    = ReportSeries::today( $zone );
		$from     = ReportQueries::dayStartUtc( ReportQueries::addDays( $today, -6 ), $zone );
		$to       = ReportQueries::dayStartUtc( ReportQueries::addDays( $today, 1 ), $zone );
		$per      = ReportQueries::perForm( $from, $to, $zone );
		$daily    = array();
		$week     = 0;
		for ( $i = 6; $i >= 0; $i-- ) {
			$date = ReportQueries::addDays( $today, -$i );
			$n    = 0;
			foreach ( $per as $row ) {
				$n += (int) ( $row['days'][ $date ] ?? 0 );
			}
			$daily[] = $n;
			$week   += $n;
		}
		uasort(
			$per,
			static function ( array $a, array $b ): int {
				return $b['entries'] <=> $a['entries'];
			}
		);
		$top = array();
		foreach ( array_slice( $per, 0, 3, true ) as $id => $row ) {
			$form  = $forms->find( (int) $id );
			$top[] = array(
				'id'      => (int) $id,
				'title'   => $form ? (string) ( $form['title'] ?? '' ) : '',
				'entries' => (int) $row['entries'],
			);
		}
		$data = array(
			'forms'  => $forms->count(),
			'week'   => $week,
			'days'   => $daily,
			'unread' => AdminMenu::unread_count(),
			'top'    => $top,
		);
		set_transient( $key, $data, self::TTL );
		return $data;
	}

	/**
	 * Points of the sparkline for seven daily counts.
	 *
	 * @param int[] $days Counts, oldest first.
	 * @param int   $w    Width.
	 * @param int   $h    Height.
	 * @return string `x,y x,y ...`
	 */
	public static function sparkPoints( array $days, int $w = 120, int $h = 32 ): string {
		$max  = max( 1, ...array_map( 'intval', $days ) ?: array( 1 ) );
		$n    = count( $days );
		$step = $n > 1 ? $w / ( $n - 1 ) : 0;
		$out  = array();
		foreach ( array_values( $days ) as $i => $v ) {
			$out[] = round( $i * $step, 1 ) . ',' . round( $h - 2 - ( (int) $v / $max ) * ( $h - 4 ), 1 );
		}
		return implode( ' ', $out );
	}

	/**
	 * Print the widget.
	 */
	public static function render(): void {
		$data   = self::data();
		$new    = admin_url( 'admin.php?page=subtleforms-new-form' );
		$all    = admin_url( 'admin.php?page=subtleforms-submissions' );

		if ( $data['forms'] < 1 ) {
			echo '<p>' . esc_html__( 'Collect messages, quotes and sign-ups from your visitors.', 'subtleforms' ) . '</p>';
			echo '<p><a class="button button-primary" href="' . esc_url( $new ) . '">' . esc_html__( 'Create your first form', 'subtleforms' ) . '</a></p>';
			return;
		}

		echo '<div class="sf-wp-widget" style="display:flex;align-items:center;justify-content:space-between;gap:16px;">';
		echo '<div><span style="font-size:28px;font-weight:600;line-height:1.1;">' . esc_html( number_format_i18n( $data['week'] ) ) . '</span><br><span style="color:#646970;">'
			. esc_html( _n( 'entry in the last 7 days', 'entries in the last 7 days', $data['week'], 'subtleforms' ) ) . '</span></div>';
		echo '<svg role="img" aria-label="' . esc_attr__( 'Entries per day, last 7 days', 'subtleforms' ) . '" width="120" height="32" viewBox="0 0 120 32">'
			. '<polyline fill="none" stroke="#3858e9" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" points="' . esc_attr( self::sparkPoints( $data['days'] ) ) . '"/></svg>';
		echo '</div>';

		echo '<p style="margin:12px 0 4px;">';
		if ( $data['unread'] > 0 ) {
			echo '<a href="' . esc_url( add_query_arg( 'unread', '1', $all ) ) . '">' . esc_html(
				sprintf(
					/* translators: %s: number of unread entries. */
					_n( '%s unread entry', '%s unread entries', $data['unread'], 'subtleforms' ),
					number_format_i18n( $data['unread'] )
				)
			) . '</a>';
		} else {
			echo esc_html__( 'No unread entries.', 'subtleforms' );
		}
		echo '</p>';

		if ( $data['top'] ) {
			echo '<h3 style="margin:12px 0 4px;font-size:13px;">' . esc_html__( 'Top forms this week', 'subtleforms' ) . '</h3><ul style="margin:0;">';
			foreach ( $data['top'] as $form ) {
				echo '<li style="display:flex;justify-content:space-between;margin:0;padding:4px 0;"><a href="' . esc_url( admin_url( 'admin.php?page=subtleforms-new-form&form_id=' . (int) $form['id'] ) ) . '">'
					. esc_html( '' !== $form['title'] ? $form['title'] : __( 'Untitled', 'subtleforms' ) ) . '</a><span>' . esc_html( number_format_i18n( $form['entries'] ) ) . '</span></li>';
			}
			echo '</ul>';
		}

		echo '<p style="margin:12px 0 0;display:flex;gap:12px;"><a class="button" href="' . esc_url( $all ) . '">' . esc_html__( 'View submissions', 'subtleforms' ) . '</a>'
			. '<a class="button" href="' . esc_url( $new ) . '">' . esc_html__( 'Add new form', 'subtleforms' ) . '</a></p>';
	}
}
