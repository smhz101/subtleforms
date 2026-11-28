<?php
/**
 * Checks whether the private uploads folder can be opened from the web.
 *
 * The folder carries .htaccess and web.config deny rules, which nginx and
 * some other servers ignore. This class asks the site for a probe file in
 * that folder and reports the result in Site Health and, after activation
 * and on a daily re-check, as a notice on SubtleForms screens with the nginx rule to add (issue 169).
 * The notice is hooked from AdminNotices, which owns every admin notice.
 *
 * @package SubtleForms\Uploads
 */

namespace SubtleForms\Uploads;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Probe, Site Health test and admin notice for the uploads folder.
 */
final class UploadsExposure {

	public const PROTECTED = 'protected';
	public const EXPOSED   = 'exposed';
	public const UNKNOWN   = 'unknown';

	/**
	 * Last result and when it was taken. Kept as an option, not a transient,
	 * so an exposed folder keeps its warning until a later check finds it
	 * protected.
	 */
	public const RESULT_OPTION = 'subtleforms_uploads_exposure';

	/** How often admin pages re-check, in seconds (one day). */
	public const RECHECK_AFTER = 86400;

	/** Set on activation: run the check on the next admin page load. */
	public const PENDING_OPTION = 'subtleforms_uploads_check_pending';

	/** User meta: the person dismissed the notice. */
	public const DISMISSED_META = 'subtleforms_dismissed_uploads_notice';

	public const DISMISS_ACTION = 'subtleforms_dismiss_uploads_notice';

	/**
	 * Wire the Site Health test, the pending check and the dismiss handler.
	 */
	public static function register(): void {
		add_filter( 'site_status_tests', array( self::class, 'addSiteHealthTest' ) );
		add_action( 'admin_init', array( self::class, 'runPendingCheck' ) );
		add_action( 'admin_post_' . self::DISMISS_ACTION, array( self::class, 'dismissNotice' ) );
	}

	/**
	 * Called from activation: check on the next admin page load, so the
	 * activation request does not wait on a loopback request.
	 */
	public static function scheduleCheck(): void {
		update_option( self::PENDING_OPTION, 1, false );
	}

	/**
	 * Run the check left by activation, and re-check once a day, on an admin
	 * page load by a person who can act on it.
	 */
	public static function runPendingCheck(): void {
		if ( wp_doing_ajax() || ! current_user_can( 'manage_options' ) ) {
			return;
		}
		$pending = (bool) get_option( self::PENDING_OPTION );
		if ( ! $pending && ! self::isStale( self::storedResult(), time() ) ) {
			return;
		}
		delete_option( self::PENDING_OPTION );
		self::check();
	}

	/**
	 * Whether a stored result is missing or older than RECHECK_AFTER.
	 *
	 * @param array|null $stored Stored result with 'checked', or null.
	 * @param int        $now    Current time.
	 */
	public static function isStale( ?array $stored, int $now ): bool {
		return null === $stored || ( $now - (int) ( $stored['checked'] ?? 0 ) ) >= self::RECHECK_AFTER;
	}

	/**
	 * Ask the site for a probe file in the uploads folder and store the result.
	 *
	 * @return string One of the status constants.
	 */
	public static function check(): string {
		$base = Uploads::ensureBaseDir();
		if ( null === $base ) {
			return self::store( self::UNKNOWN );
		}

		$name     = 'sf-probe-' . bin2hex( random_bytes( 6 ) ) . '.txt';
		$contents = 'subtleforms-probe-' . bin2hex( random_bytes( 8 ) );
		$file     = $base . '/' . $name;
		if ( false === file_put_contents( $file, $contents ) ) { // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents -- our own private folder, removed below.
			return self::store( self::UNKNOWN );
		}

		$response = wp_remote_get(
			self::folderUrl() . $name,
			array(
				'timeout'     => 5,
				'redirection' => 0,
				'sslverify'   => apply_filters( 'https_local_ssl_verify', false ),
			)
		);
		wp_delete_file( $file );

		if ( is_wp_error( $response ) ) {
			return self::store( self::UNKNOWN );
		}
		return self::store(
			self::classify( (int) wp_remote_retrieve_response_code( $response ), (string) wp_remote_retrieve_body( $response ), $contents )
		);
	}

	/**
	 * Read a probe response: the exact probe text back means anyone can open
	 * files in the folder; a refusal or not-found means they cannot.
	 *
	 * @param int    $code     HTTP status.
	 * @param string $body     Response body.
	 * @param string $expected Probe file contents.
	 */
	public static function classify( int $code, string $body, string $expected ): string {
		if ( 200 === $code ) {
			return trim( $body ) === $expected ? self::EXPOSED : self::UNKNOWN;
		}
		if ( in_array( $code, array( 401, 403, 404, 410 ), true ) ) {
			return self::PROTECTED;
		}
		return self::UNKNOWN;
	}

	/**
	 * The nginx rule that blocks the folder.
	 *
	 * @param string $path Folder path from the site root, with a trailing slash.
	 */
	public static function nginxRule( string $path ): string {
		return "location ^~ {$path} {\n\tdeny all;\n}";
	}

	/**
	 * Last stored result, or null when none is stored.
	 */
	public static function lastResult(): ?string {
		$stored = self::storedResult();
		return null === $stored ? null : $stored['status'];
	}

	/**
	 * The stored result, or null when none is stored or it is malformed.
	 *
	 * @return array{status: string, checked: int}|null
	 */
	private static function storedResult(): ?array {
		$value = get_option( self::RESULT_OPTION );
		if ( ! is_array( $value ) || ! isset( $value['status'] ) || ! in_array( $value['status'], array( self::PROTECTED, self::EXPOSED, self::UNKNOWN ), true ) ) {
			return null;
		}
		return array( 'status' => $value['status'], 'checked' => (int) ( $value['checked'] ?? 0 ) );
	}

	/**
	 * Add the test to Tools > Site Health.
	 *
	 * @param array $tests Site Health tests.
	 */
	public static function addSiteHealthTest( $tests ) {
		if ( ! is_array( $tests ) ) {
			return $tests;
		}
		$tests['direct']['subtleforms_uploads_private'] = array(
			'label' => __( 'SubtleForms uploaded files are private', 'subtleforms' ),
			'test'  => array( self::class, 'siteHealthResult' ),
		);
		return $tests;
	}

	/**
	 * Site Health result: runs a fresh check each time the screen loads.
	 */
	public static function siteHealthResult(): array {
		$status = self::check();
		$badge  = array(
			'label' => __( 'Security', 'subtleforms' ),
			'color' => self::EXPOSED === $status ? 'red' : 'blue',
		);

		if ( self::EXPOSED === $status ) {
			return array(
				'label'       => __( 'Files uploaded to SubtleForms forms can be opened by anyone with the link', 'subtleforms' ),
				'status'      => 'critical',
				'badge'       => $badge,
				'description' => self::stepsHtml( self::serverKind( self::serverSoftware() ) )
					. '<p>' . esc_html__( 'Files stay available to you in the entry screen, which serves them through WordPress.', 'subtleforms' ) . '</p>',
				'test'        => 'subtleforms_uploads_private',
			);
		}

		if ( self::PROTECTED === $status ) {
			return array(
				'label'       => __( 'SubtleForms uploaded files are private', 'subtleforms' ),
				'status'      => 'good',
				'badge'       => $badge,
				'description' => '<p>' . esc_html__( 'Files uploaded to your forms cannot be opened directly from the web. You open them from the entry screen.', 'subtleforms' ) . '</p>',
				'test'        => 'subtleforms_uploads_private',
			);
		}

		return array(
			'label'       => __( 'SubtleForms could not check whether uploaded files are private', 'subtleforms' ),
			'status'      => 'recommended',
			'badge'       => $badge,
			'description' => '<p>' . esc_html__( 'The site could not request a test file from its own uploads folder. Check that this address returns "403 Forbidden" or "404 Not Found" for any file in it:', 'subtleforms' ) . '</p>'
				. '<p><code>' . esc_html( self::folderUrl() ) . '</code></p>'
				. '<p>' . esc_html__( 'On nginx, this rule blocks the folder:', 'subtleforms' ) . '</p>'
				. '<pre><code>' . esc_html( self::nginxRule( self::folderPath() ) ) . '</code></pre>',
			'test'        => 'subtleforms_uploads_private',
		);
	}

	/**
	 * Notice for administrators, on SubtleForms screens, while the last check
	 * found the folder open.
	 */
	public static function maybeShowNotice(): void {
		$screen = function_exists( 'get_current_screen' ) ? get_current_screen() : null;
		if ( ! $screen || false === strpos( (string) $screen->id, 'subtleforms' ) ) {
			return;
		}
		if ( ! current_user_can( 'manage_options' ) || self::EXPOSED !== self::lastResult() ) {
			return;
		}
		if ( get_user_meta( get_current_user_id(), self::DISMISSED_META, true ) ) {
			return;
		}
		self::renderNotice(
			self::serverKind( self::serverSoftware() ),
			admin_url( 'site-health.php' ),
			wp_nonce_url( admin_url( 'admin-post.php?action=' . self::DISMISS_ACTION ), self::DISMISS_ACTION )
		);
	}

	/**
	 * Print the notice markup.
	 *
	 * @param string $kind       Result of serverKind().
	 * @param string $healthUrl  Site Health address.
	 * @param string $dismissUrl Dismiss link.
	 */
	public static function renderNotice( string $kind, string $healthUrl, string $dismissUrl ): void {
		echo '<div class="notice notice-warning"><p><strong>' . esc_html__( 'SubtleForms: uploaded files are not private on this server.', 'subtleforms' ) . '</strong></p>'
			. self::stepsHtml( $kind ) // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Escaped in stepsHtml().
			. '<p><a href="' . esc_url( $healthUrl ) . '">' . esc_html__( 'Open Site Health', 'subtleforms' ) . '</a> | <a href="' . esc_url( $dismissUrl ) . '">' . esc_html__( 'Dismiss', 'subtleforms' ) . '</a></p></div>';
	}

	/**
	 * Server family from a SERVER_SOFTWARE string. LiteSpeed reads .htaccess
	 * like Apache.
	 *
	 * @return string 'nginx', 'apache' or 'unknown'.
	 */
	public static function serverKind( string $software ): string {
		$software = strtolower( $software );
		if ( false !== strpos( $software, 'nginx' ) ) {
			return 'nginx';
		}
		if ( false !== strpos( $software, 'apache' ) || false !== strpos( $software, 'litespeed' ) ) {
			return 'apache';
		}
		return 'unknown';
	}

	private static function serverSoftware(): string {
		return isset( $_SERVER['SERVER_SOFTWARE'] ) ? sanitize_text_field( wp_unslash( $_SERVER['SERVER_SOFTWARE'] ) ) : '';
	}

	/**
	 * Escaped steps for the notice and Site Health: what is wrong, the fix for
	 * this server, then the host fallback.
	 */
	private static function stepsHtml( string $kind ): string {
		$rule   = '<pre><code>' . esc_html( self::nginxRule( self::folderPath() ) ) . '</code></pre>';
		$nginx  = '<p>' . esc_html__( 'Add this rule to your nginx site configuration:', 'subtleforms' ) . '</p>' . $rule
			. '<p>' . esc_html__( 'Reload nginx, then check again in Tools > Site Health.', 'subtleforms' ) . '</p>';
		$apache = '<p>' . esc_html__( 'Your server is not reading the .htaccess file in the uploads folder. Ask your host to allow .htaccess files (AllowOverride) or to block this folder:', 'subtleforms' ) . '</p>'
			. '<p><code>' . esc_html( self::folderPath() ) . '</code></p>'
			. '<p>' . esc_html__( 'Then check again in Tools > Site Health.', 'subtleforms' ) . '</p>';

		if ( 'nginx' === $kind ) {
			$fix = $nginx;
		} elseif ( 'apache' === $kind ) {
			$fix = $apache;
		} else {
			$fix = $nginx . '<p>' . esc_html__( 'On Apache or LiteSpeed, ask your host to allow .htaccess files (AllowOverride) in this folder.', 'subtleforms' ) . '</p>';
		}

		return '<p>' . esc_html__( 'Your server ignores the folder rules, so anyone with a file\'s address can open it.', 'subtleforms' ) . '</p>'
			. $fix
			. '<p>' . esc_html__( 'If you cannot edit the server configuration, send this to your host.', 'subtleforms' ) . '</p>';
	}

	/**
	 * Remember that the current person dismissed the notice.
	 */
	public static function dismissNotice(): void {
		check_admin_referer( self::DISMISS_ACTION );
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'Sorry, you are not allowed to do that.', 'subtleforms' ), '', array( 'response' => 403 ) );
		}
		update_user_meta( get_current_user_id(), self::DISMISSED_META, 1 );
		wp_safe_redirect( wp_get_referer() ? wp_get_referer() : admin_url() );
		exit;
	}

	private static function store( string $status ): string {
		update_option( self::RESULT_OPTION, array( 'status' => $status, 'checked' => time() ), false );
		return $status;
	}

	/**
	 * Public address of the uploads folder, with a trailing slash.
	 */
	private static function folderUrl(): string {
		$uploads = wp_upload_dir( null, false );
		return rtrim( (string) $uploads['baseurl'], '/' ) . '/' . Uploads::folderName() . '/';
	}

	/**
	 * Path of the uploads folder from the site root, with a trailing slash.
	 */
	private static function folderPath(): string {
		$path = (string) wp_parse_url( self::folderUrl(), PHP_URL_PATH );
		return '' === $path ? '/' : $path;
	}
}
