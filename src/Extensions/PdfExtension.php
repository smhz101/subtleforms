<?php


declare(strict_types=1);

namespace SubtleForms\Extensions;

if ( ! defined( 'ABSPATH' ) ) { exit; }

/**
 * PDF Extension
 *
 * Owns the "Attach to notification email" setting. The PDF itself is
 * rendered by SubtleForms Pro, which answers the `subtleforms/pdf/generate`
 * filter with the path of a file it wrote, and also provides the entry PDF
 * download on the entry screen.
 *
 * Attachments are added inside the background email job (see
 * AsyncDispatcher::executeEmail), so rendering a PDF never delays the
 * visitor's submission.
 */
class PdfExtension extends AbstractExtension {

	public function slug(): string {
		return 'pdf';
	}

	public function label(): string {
		return 'PDF Generator';
	}

	public function register(): void {
		if ( ! $this->isEnabled() ) {
			return;
		}

		if ( (bool) $this->getSetting( 'attach_to_email' ) ) {
			add_filter( 'subtleforms/email/attachments', array( $this, 'attachPdf' ), 10, 2 );
		}
	}

	/**
	 * Attach the entry PDF to admin notification emails.
	 *
	 * @param array $attachments Existing attachment paths.
	 * @param array $job         Email job: submission_id, form_id, audience.
	 * @return array
	 */
	public function attachPdf( $attachments, $job = array() ): array {
		$attachments = is_array( $attachments ) ? $attachments : array();
		$job         = is_array( $job ) ? $job : array();

		$submission_id = (int) ( $job['submission_id'] ?? 0 );
		if ( $submission_id <= 0 || 'admin' !== ( $job['audience'] ?? 'admin' ) ) {
			return $attachments;
		}

		/**
		 * Render the entry PDF for an email attachment.
		 *
		 * Return the absolute path of a PDF file, or null when no renderer is
		 * available. SubtleForms Pro implements this.
		 *
		 * @param string|null $path          Null by default.
		 * @param int         $submission_id Entry ID.
		 * @param array       $job           Email job.
		 * @since 2.1.0
		 */
		$path = apply_filters( 'subtleforms/pdf/generate', null, $submission_id, $job );

		if ( is_string( $path ) && '' !== $path && file_exists( $path ) ) {
			$attachments[] = $path;
		}

		return $attachments;
	}
}
