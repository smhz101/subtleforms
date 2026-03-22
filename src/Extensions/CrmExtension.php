<?php
declare(strict_types=1);

namespace SubtleForms\Extensions;

/**
 * CRM Extension
 *
 * Creates or updates a contact in a CRM (currently HubSpot) on every
 * new form submission.
 */
class CrmExtension extends AbstractExtension {

	public function slug(): string {
		return 'crm';
	}

	public function label(): string {
		return 'CRM';
	}

	public function register(): void {
		if ( ! $this->isEnabled() ) {
			return;
		}

		add_action( 'subtleforms/submission/saved', array( $this, 'createContact' ), 10, 2 );
	}

	/**
	 * Create or upsert a contact in the configured CRM.
	 *
	 * @param int   $form_id    The form ID.
	 * @param array $submission Submission data array.
	 */
	public function createContact( int $form_id, array $submission ): void {
		$provider = (string) $this->getSetting( 'provider' );
		$api_key  = (string) $this->getSetting( 'api_key' );

		if ( ! $api_key ) {
			return;
		}

		$email = $this->extractEmail( $submission );

		if ( 'hubspot' === $provider ) {
			$this->hubspotUpsert( $email, $submission['data'] ?? array(), $api_key );
		}
	}

	private function hubspotUpsert( string $email, array $data, string $api_key ): void {
		// Build a flat properties array from submission data.
		$properties = array();
		if ( $email ) {
			$properties['email'] = $email;
		}

		// Map common field names to HubSpot property names.
		$map = array(
			'name'       => 'firstname',
			'first_name' => 'firstname',
			'last_name'  => 'lastname',
			'phone'      => 'phone',
			'company'    => 'company',
			'website'    => 'website',
			'message'    => 'message',
		);

		foreach ( $data as $key => $value ) {
			$hs_key = $map[ strtolower( $key ) ] ?? null;
			if ( $hs_key ) {
				$properties[ $hs_key ] = $value;
			}
		}

		if ( empty( $properties ) ) {
			return;
		}

		// Use HubSpot Contacts v3 upsert endpoint.
		$url = 'https://api.hubapi.com/crm/v3/objects/contacts';

		wp_remote_post(
			$url,
			array(
				'headers'   => array(
					'Content-Type'  => 'application/json',
					'Authorization' => 'Bearer ' . $api_key,
				),
				'body'      => wp_json_encode( array( 'properties' => $properties ) ),
				'timeout'   => 15,
				'blocking'  => false,
				'sslverify' => true,
			)
		);
	}

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
