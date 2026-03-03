<?php

namespace SubtleForms\Licensing;

use SubtleForms\Licensing\LicenseManager;

/**
 * License Scheduler
 *
 * Handles scheduled license validation checks and notifications.
 *
 * @package SubtleForms\Licensing
 * @since 2.0.0
 */
class LicenseScheduler {

	/**
	 * @var LicenseManager
	 */
	private $license_manager;

	/**
	 * Constructor
	 *
	 * @param LicenseManager $license_manager License manager
	 */
	public function __construct( LicenseManager $license_manager ) {
		$this->license_manager = $license_manager;
	}

	/**
	 * Register scheduler hooks
	 */
	public function register() {
		// Schedule daily license check
		add_action( 'subtleforms_daily_license_check', array( $this, 'check_license_status' ) );

		// Add admin notices for license warnings
		add_action( 'admin_notices', array( $this, 'show_license_notices' ) );

		// Schedule event if not already scheduled
		if ( ! wp_next_scheduled( 'subtleforms_daily_license_check' ) ) {
			wp_schedule_event( time(), 'daily', 'subtleforms_daily_license_check' );
		}
	}

	/**
	 * Unregister scheduler hooks
	 */
	public function unregister() {
		$timestamp = wp_next_scheduled( 'subtleforms_daily_license_check' );
		if ( $timestamp ) {
			wp_unschedule_event( $timestamp, 'subtleforms_daily_license_check' );
		}
	}

	/**
	 * Check license status (runs daily)
	 */
	public function check_license_status() {
		// Force refresh license data
		$data = $this->license_manager->getLicenseData( true );

		// Log check for debugging
		if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
			error_log( 'SubtleForms License Check: Status = ' . $data['status'] );
		}

		// Send expiration warnings if needed
		$this->maybe_send_expiration_warning( $data );
	}

	/**
	 * Send expiration warning emails
	 *
	 * @param array $data License data
	 */
	private function maybe_send_expiration_warning( $data ) {
		// Only send for valid/grace period licenses
		if ( ! in_array( $data['status'], array( LicenseManager::STATUS_VALID, LicenseManager::STATUS_GRACE_PERIOD ), true ) ) {
			return;
		}

		// Get days until expiration
		$days = $this->license_manager->getDaysUntilExpiration();

		if ( null === $days ) {
			return; // No expiration (lifetime license)
		}

		// Send warnings at 30, 14, 7, 3, 1 days before expiration
		$warning_days = array( 30, 14, 7, 3, 1 );

		foreach ( $warning_days as $warning_day ) {
			if ( $days === $warning_day ) {
				$this->send_expiration_email( $days );
				break;
			}
		}
	}

	/**
	 * Send expiration warning email
	 *
	 * @param int $days Days until expiration
	 */
	private function send_expiration_email( $days ) {
		$admin_email = get_option( 'admin_email' );
		$site_name   = get_bloginfo( 'name' );

		$subject = sprintf(
			/* translators: %s: site name */
			__( '[%s] SubtleForms Pro License Expiration Warning', 'subtleforms' ),
			$site_name
		);

		$message = sprintf(
			/* translators: 1: days remaining, 2: site URL, 3: renewal URL */
			__( "Your SubtleForms Pro license will expire in %1\$d days.\n\nSite: %2\$s\n\nTo renew your license and continue enjoying Pro features, please visit:\n%3\$s\n\nIf you have any questions, please contact our support team.", 'subtleforms' ),
			$days,
			home_url(),
			'https://subtleforms.com/account/'
		);

		// Send email
		wp_mail( $admin_email, $subject, $message );

		// Store sent notification to avoid duplicates
		$sent_key = 'subtleforms_license_warning_' . $days . '_sent';
		$sent_at  = get_transient( $sent_key );

		if ( ! $sent_at ) {
			set_transient( $sent_key, time(), DAY_IN_SECONDS );
		}
	}

	/**
	 * Show admin notices for license warnings
	 */
	public function show_license_notices() {
		// Only show on SubtleForms pages
		$screen = get_current_screen();
		if ( ! $screen || strpos( $screen->id, 'subtleforms' ) === false ) {
			return;
		}

		// Check if user can manage options
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}

		$data = $this->license_manager->getLicenseData();

		// Expired license notice
		if ( $data['status'] === LicenseManager::STATUS_EXPIRED ) {
			$this->show_expired_notice();
			return;
		}

		// Grace period notice
		if ( $data['status'] === LicenseManager::STATUS_GRACE_PERIOD ) {
			$this->show_grace_period_notice();
			return;
		}

		// Expiration warning notice
		$days = $this->license_manager->getDaysUntilExpiration();
		if ( $days !== null && $days <= 30 ) {
			$this->show_expiration_warning_notice( $days );
		}
	}

	/**
	 * Show expired license notice
	 */
	private function show_expired_notice() {
		?>
		<div class="notice notice-error is-dismissible">
			<p>
				<strong><?php esc_html_e( 'SubtleForms Pro License Expired', 'subtleforms' ); ?></strong>
			</p>
			<p>
				<?php
				printf(
					/* translators: 1: renewal URL, 2: settings URL */
					__( 'Your Pro license has expired. Please <a href="%1$s" target="_blank">renew your license</a> to continue using Pro features. <a href="%2$s">Manage License</a>', 'subtleforms' ),
					esc_url( 'https://subtleforms.com/account/' ),
					esc_url( admin_url( 'admin.php?page=subtleforms-settings&tab=license' ) )
				);
				?>
			</p>
		</div>
		<?php
	}

	/**
	 * Show grace period notice
	 */
	private function show_grace_period_notice() {
		?>
		<div class="notice notice-warning is-dismissible">
			<p>
				<strong><?php esc_html_e( 'SubtleForms Pro License in Grace Period', 'subtleforms' ); ?></strong>
			</p>
			<p>
				<?php
				printf(
					/* translators: 1: renewal URL, 2: settings URL */
					__( 'Your license has expired but is in grace period. Pro features will be disabled soon. Please <a href="%1$s" target="_blank">renew your license</a>. <a href="%2$s">Manage License</a>', 'subtleforms' ),
					esc_url( 'https://subtleforms.com/account/' ),
					esc_url( admin_url( 'admin.php?page=subtleforms-settings&tab=license' ) )
				);
				?>
			</p>
		</div>
		<?php
	}

	/**
	 * Show expiration warning notice
	 *
	 * @param int $days Days until expiration
	 */
	private function show_expiration_warning_notice( $days ) {
		?>
		<div class="notice notice-warning is-dismissible">
			<p>
				<strong>
					<?php
					printf(
						/* translators: %d: days remaining */
						_n(
							'SubtleForms Pro License Expires in %d Day',
							'SubtleForms Pro License Expires in %d Days',
							$days,
							'subtleforms'
						),
						$days
					);
					?>
				</strong>
			</p>
			<p>
				<?php
				printf(
					/* translators: 1: renewal URL, 2: settings URL */
					__( 'Your license will expire soon. <a href="%1$s" target="_blank">Renew now</a> to avoid service interruption. <a href="%2$s">Manage License</a>', 'subtleforms' ),
					esc_url( 'https://subtleforms.com/account/' ),
					esc_url( admin_url( 'admin.php?page=subtleforms-settings&tab=license' ) )
				);
				?>
			</p>
		</div>
		<?php
	}
}
