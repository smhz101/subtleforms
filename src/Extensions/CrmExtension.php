<?php


declare(strict_types=1);

namespace SubtleForms\Extensions;

if ( ! defined( 'ABSPATH' ) ) { exit; }

/**
 * CRM Extension
 *
 * Free-plugin stub. The actual HubSpot integration is implemented by the
 * Pro plugin, which hooks into: `subtleforms_extension_crm_contact`
 *
 * No external API calls are made here.
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

		add_action( 'subtleforms_submission_saved', array( $this, 'createContact' ), 10, 2 );
	}

	/**
	 * Delegates to the Pro plugin via an action hook. No HTTP calls made here.
	 *
	 * @param int   $form_id    The form ID.
	 * @param array $submission Submission data array.
	 */
	public function createContact( int $form_id, array $submission ): void {
		/**
		 * Fires when a form submission should create or update a CRM contact.
		 *
		 * The Pro plugin hooks here to implement HubSpot (and other CRM) calls.
		 *
		 * @param int                           $form_id    Form ID.
		 * @param array                         $submission Submission data.
		 * @param \SubtleForms\Support\Settings $settings   Plugin settings instance.
		 */
		do_action( 'subtleforms_extension_crm_contact', $form_id, $submission, $this->settings );
	}
}
