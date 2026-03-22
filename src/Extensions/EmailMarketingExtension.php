<?php
declare(strict_types=1);

namespace SubtleForms\Extensions;

/**
 * Email Marketing Extension
 *
 * Subscribes form submitters to a Mailchimp list or a ConvertKit sequence
 * depending on the configured provider.
 */
class EmailMarketingExtension extends AbstractExtension {

	public function slug(): string {
		return 'email_marketing';
	}

	public function label(): string {
		return 'Email Marketing';
	}

	public function register(): void {
		if ( ! $this->isEnabled() ) {
			return;
		}

		add_action( 'subtleforms/submission/saved', array( $this, 'subscribe' ), 10, 2 );
	}

	/**
	 * Subscribe the submitter based on the configured provider.
	 *
	 * @param int   $form_id    The form ID.
	 * @param array $submission Submission data array.
	 */
	public function subscribe( int $form_id, array $submission ): void {
		$email = $this->extractEmail( $submission );
		if ( ! $email ) {
			return;
		}

		$provider = (string) $this->getSetting( 'provider' );
		$api_key  = (string) $this->getSetting( 'api_key' );
		$list_id  = (string) $this->getSetting( 'list_id' );

		if ( ! $api_key || ! $list_id ) {
			return;
		}

		if ( 'convertkit' === $provider ) {
			$this->subscribeConvertKit( $email, $api_key, $list_id );
		} else {
			$this->subscribeMailchimp( $email, $api_key, $list_id );
		}
	}

	private function subscribeMailchimp( string $email, string $api_key, string $list_id ): void {
		// Infer datacenter from API key suffix (e.g. "us6").
		$dc     = substr( strrchr( $api_key, '-' ), 1 );
		$dc     = $dc ?: 'us1';
		$url    = "https://{$dc}.api.mailchimp.com/3.0/lists/{$list_id}/members";
		$status = (bool) $this->getSetting( 'double_optin' ) ? 'pending' : 'subscribed';

		wp_remote_post(
			$url,
			array(
				'headers'   => array(
					'Content-Type'  => 'application/json',
					'Authorization' => 'apikey ' . $api_key,
				),
				'body'      => wp_json_encode(
					array(
						'email_address' => $email,
						'status'        => $status,
					)
				),
				'timeout'   => 15,
				'blocking'  => false,
				'sslverify' => true,
			)
		);
	}

	private function subscribeConvertKit( string $email, string $api_key, string $form_id ): void {
		$url = "https://api.convertkit.com/v3/forms/{$form_id}/subscribe";

		wp_remote_post(
			$url,
			array(
				'headers'   => array( 'Content-Type' => 'application/json' ),
				'body'      => wp_json_encode(
					array(
						'api_key' => $api_key,
						'email'   => $email,
					)
				),
				'timeout'   => 15,
				'blocking'  => false,
				'sslverify' => true,
			)
		);
	}

	/**
	 * Extract a usable email address from submission data.
	 */
	private function extractEmail( array $submission ): string {
		if ( ! empty( $submission['data'] ) && is_array( $submission['data'] ) ) {
			foreach ( $submission['data'] as $value ) {
				if ( is_string( $value ) && is_email( $value ) ) {
					return $value;
				}
			}
		}
		return '';
	}
}
