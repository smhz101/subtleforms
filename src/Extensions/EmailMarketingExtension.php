<?php


declare(strict_types=1);

namespace SubtleForms\Extensions;

if ( ! defined( 'ABSPATH' ) ) { exit; }

/**
 * Email Marketing Extension
 *
 * Free-plugin stub. The actual Mailchimp / ConvertKit integration is
 * implemented by the Pro plugin, which hooks into:
 *   `subtleforms_extension_email_marketing_subscribe`
 *
 * No external API calls are made here.
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

		add_action( 'subtleforms_submission_saved', array( $this, 'subscribe' ), 10, 2 );
	}

	/**
	 * Delegates to the Pro plugin via an action hook. No HTTP calls made here.
	 *
	 * @param int   $form_id    The form ID.
	 * @param array $submission Submission data array.
	 */
	public function subscribe( int $form_id, array $submission ): void {
		/**
		 * Fires when a form submission should trigger an email list subscription.
		 *
		 * The Pro plugin hooks here to implement Mailchimp / ConvertKit calls.
		 *
		 * @param int                           $form_id    Form ID.
		 * @param array                         $submission Submission data.
		 * @param \SubtleForms\Support\Settings $settings   Plugin settings instance.
		 */
		do_action( 'subtleforms_extension_email_marketing_subscribe', $form_id, $submission, $this->settings );
	}
}

