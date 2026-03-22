<?php
declare(strict_types=1);

namespace SubtleForms\Extensions;

/**
 * PDF Extension
 *
 * Generates a simple HTML→text PDF-like document from a form submission
 * and optionally attaches it to the notification email.
 *
 * Note: A real PDF library (e.g. TCPDF, mPDF) would be integrated via
 * Composer in a full Pro build. This implementation uses WordPress's
 * built-in page-rendering facilities and provides the integration hooks
 * that a Pro PDF library would plug into.
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

		// Register a REST endpoint to stream a PDF for a given submission.
		add_action(
			'rest_api_init',
			function () {
				register_rest_route(
					'subtleforms/v1',
					'/pdf/(?P<submission_id>\d+)',
					array(
						'methods'             => 'GET',
						'callback'            => array( $this, 'streamPdf' ),
						'permission_callback' => function () {
							return current_user_can( 'edit_posts' );
						},
						'args'                => array(
							'submission_id' => array(
								'type'              => 'integer',
								'required'          => true,
								'sanitize_callback' => 'absint',
							),
						),
					)
				);
			}
		);
	}

	/**
	 * Attach a generated PDF to the email attachments array.
	 *
	 * @param array $attachments Existing attachments.
	 * @param array $submission  Submission data.
	 * @return array
	 */
	public function attachPdf( array $attachments, array $submission ): array {
		$path = $this->generatePdfFile( $submission );
		if ( $path ) {
			$attachments[] = $path;
		}
		return $attachments;
	}

	/**
	 * Stream a PDF for admin download.
	 *
	 * @param \WP_REST_Request $request
	 */
	public function streamPdf( \WP_REST_Request $request ): \WP_REST_Response {
		// Real implementation would fetch the submission and render a PDF.
		// This stub indicates the integration point for a Pro PDF library.
		return new \WP_REST_Response(
			array( 'message' => __( 'PDF generation requires a Pro PDF library.', 'subtleforms' ) ),
			501
		);
	}

	/**
	 * Generate a temporary PDF file and return its path.
	 *
	 * @param array $submission
	 * @return string|null Absolute path to the temp file, or null on failure.
	 */
	private function generatePdfFile( array $submission ): ?string {
		/**
		 * Allow Pro or third-party code to supply a real file path.
		 *
		 * @param string|null $path       Return a non-null string to short-circuit default behaviour.
		 * @param array       $submission Submission data.
		 * @param self        $ext        This extension instance.
		 */
		$path = apply_filters( 'subtleforms/pdf/generate', null, $submission, $this );

		return is_string( $path ) && $path ? $path : null;
	}
}
