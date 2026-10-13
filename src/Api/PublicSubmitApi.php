<?php
/**
 * SubtleForms Public Submit REST API
 *
 * Handles the public form submission endpoint.
 *
 * @package SubtleForms\Api
 * @since   1.9.0
 */

namespace SubtleForms\Api;

if ( ! defined( 'ABSPATH' ) ) { exit; }

use SubtleForms\Support\Helpers;
use SubtleForms\Support\Logger;
use SubtleForms\Support\Captcha\CaptchaManager;
use SubtleForms\Engine\Pipeline;
use SubtleForms\Engine\SubmissionContext;
use SubtleForms\Engine\SchemaCompiler;
use SubtleForms\Repositories\FormsRepository;
use SubtleForms\Repositories\SubmissionsRepository;
use SubtleForms\Validation\RequestValidator;
use SubtleForms\Validation\ValidationException;
use SubtleForms\Validation\Schemas;
use SubtleForms\Validation\Sanitizer;
use SubtleForms\Payments\Pricing;
use SubtleForms\Payments\CouponsRepository;
use SubtleForms\Security\RateLimiter;
use WP_REST_Request;
use WP_REST_Response;

/**
 * REST API controller for public form submissions.
 */
final class PublicSubmitApi {

	private const NAMESPACE = 'subtleforms/v1';

	/** @var Pipeline */
	private $pipeline;

	/** @var FormsRepository */
	private $formsRepo;

	/** @var SubmissionsRepository */
	private $submissionsRepo;

	/** @var SchemaCompiler */
	private $compiler;

	/** @var CaptchaManager|null */
	private $captchaManager;

	public function __construct(
		Pipeline $pipeline,
		FormsRepository $formsRepo,
		SubmissionsRepository $submissionsRepo,
		SchemaCompiler $compiler,
		?CaptchaManager $captchaManager = null
	) {
		$this->pipeline        = $pipeline;
		$this->formsRepo       = $formsRepo;
		$this->submissionsRepo = $submissionsRepo;
		$this->compiler        = $compiler;
		$this->captchaManager  = $captchaManager;
	}

	/**
	 * Register REST API routes.
	 */
	public function registerRoutes(): void {
		register_rest_route(
			self::NAMESPACE,
			'/submit',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'submit_form' ),
				'permission_callback' => '__return_true',
				'args'                => array(
					'form_id' => array(
						'type'              => 'integer',
						'required'          => true,
						'minimum'           => 1,
						'sanitize_callback' => static function ( $value ) { return (int) $value; },
					),
				),
			)
		);
	}

	/**
	 * Submit a form (public endpoint).
	 */
	public function submit_form( WP_REST_Request $request ): WP_REST_Response {
		// Rate limiting
		$rateLimitResponse = $this->guardRateLimit( $request );
		if ( $rateLimitResponse ) {
			return $rateLimitResponse;
		}

		$ip = isset( $_SERVER['REMOTE_ADDR'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) ) : '';

		// Validate form ID
		try {
			$formId = Schemas::validateId( $request->get_param( 'form_id' ) );
		} catch ( ValidationException $e ) {
			return ApiResponse::validation_error( $e->getMessage(), $e->getFields() );
		}

		// Validate and sanitize submission payload
		$rawInput = $request->get_json_params();
		if ( ! is_array( $rawInput ) ) {
			$rawInput = array();
		}

		try {
			$validator = new RequestValidator( array( 'schemas' => Schemas::all() ) );
			$validated = $validator->validateOrFail( $rawInput, Schemas::get( Schemas::PUBLIC_SUBMIT ) );
		} catch ( ValidationException $e ) {
			return ApiResponse::validation_error( $e->getMessage(), $e->getFields() );
		}

	$payload = $validated['data'] ?? array();
	$payload = is_array( $payload ) ? Sanitizer::sanitizeArrayDeep( $payload ) : array();

	// Honeypot: a hidden "website_url" field real users never see. If it has
	// any value, the submitter is a bot — silently drop the submission (return
	// success without saving) so bots don't learn the field is a trap and retry,
	// matching the existing SpamProtection pattern (Part B3).
	$honeypot = isset( $payload['website_url'] ) ? (string) $payload['website_url'] : '';
	if ( $honeypot !== '' ) {
		Logger::info( 'Honeypot tripped on form %d — dropping submission', $formId );
		return ApiResponse::success(
			array(
				'success' => true,
				'message' => __( 'Thank you.', 'subtleforms' ),
			)
		);
	}

	// Spam protection
		if ( \SubtleForms\Engine\SpamProtection::is_enabled() ) {
			$tempContext = new SubmissionContext( $formId, $payload );
			if ( \SubtleForms\Engine\SpamProtection::is_spam( $tempContext ) ) {
				$reason = $tempContext->getMeta( 'spam_reason', 'spam_detected' );
				Logger::info( 'Spam blocked (form %d): %s', $formId, $reason );
				return ApiResponse::success(
					array(
						'success' => true,
						'message' => __( 'Thank you.', 'subtleforms' ),
					)
				);
			}
		}

		// CAPTCHA verification
		if ( $this->captchaManager && $this->captchaManager->isEnabled() && $this->captchaManager->isConfigured() ) {
			$verification = $this->captchaManager->verify( $payload );
			if ( ! $verification['success'] ) {
				return ApiResponse::bad_request(
					$verification['error'] ?? __( 'CAPTCHA verification failed.', 'subtleforms' )
				);
			}
		}

		// Verify form exists
		$form = $this->formsRepo->find( $formId );
		if ( ! $form || ( $form['status'] ?? '' ) !== 'published' ) {
			return ApiResponse::not_found( __( 'Form not found', 'subtleforms' ) );
		}

		// Check submission limit
		$settings = get_option( 'subtleforms_settings', array() );
		if ( ! empty( $settings['submission_limit_enabled'] ) ) {
			$limit   = isset( $settings['submission_limit'] ) ? (int) $settings['submission_limit'] : 1;
			$user_id = get_current_user_id();

			// Identify the submitter by account when logged in, otherwise by IP.
			// These must never be OR'd together: user_id is 0 for every guest, so
			// matching on it would count all guests as a single submitter and lock
			// the form for everyone once the limit is reached.
			$count = null;

			if ( $user_id > 0 ) {
				$count = $this->countSubmissionsBy( $formId, 'user_id = %d', $user_id );
			} elseif ( $ip !== '' ) {
				$count = $this->countSubmissionsBy( $formId, 'ip_address = %s', $ip );
			}

			if ( $count !== null && $count >= $limit ) {
				return ApiResponse::forbidden(
					__( 'You have reached the maximum number of submissions for this form.', 'subtleforms' )
				);
			}
		}

		// Resolve active schema version
		try {
			$activeSchema = $this->formsRepo->loadSchemaVersion( $formId );
		} catch ( \RuntimeException $e ) {
			Logger::error( 'Submission Error: %s', $e->getMessage() );
			return ApiResponse::server_error( __( 'This form is temporarily unavailable. Please try again later.', 'subtleforms' ) );
		}
		$formVersion = $activeSchema['version'] ?? null;

		// Login, schedule and entry-limit rules (2.0). Checked here as well as
		// at render time so they cannot be bypassed by posting directly.
		$blocked = \SubtleForms\Engine\FormRestrictions::blockedReason( $formId, $activeSchema['schema'] ?? $activeSchema );
		if ( $blocked !== null ) {
			return ApiResponse::forbidden( $blocked );
		}

		// Restore rich_text values from the raw request.
		//
		// sanitizeArrayDeep() above runs wp_strip_all_tags over every value, which
		// is the right default but destroys the markup a rich_text field exists to
		// collect. The schema is only known here, so re-sanitize just those keys
		// with a narrow allowlist. Anything not declared rich_text in the schema
		// keeps the strict treatment.
		$payload = $this->restoreRichTextValues(
			$payload,
			$rawInput['data'] ?? array(),
			$activeSchema['schema'] ?? $activeSchema
		);

		// Recompute Calculation fields server-side so a visitor cannot post a
		// tampered total (2.0).
		$payload = self::applyCalculations( $payload, $activeSchema['schema'] ?? $activeSchema );

		// Conditional logic (2.1): answers to fields the visitor could not see
		// (hidden fields and skipped steps) are never stored, priced or sent.
		$schemaForLogic = $activeSchema['schema'] ?? $activeSchema;
		if ( is_array( $schemaForLogic ) ) {
			$payload = ( new \SubtleForms\Engine\ConditionalLogic() )->visiblePayload( $schemaForLogic, $payload );
		}

		// File uploads (2.1): swap upload IDs for the files already stored.
		$payload = \SubtleForms\Uploads\Uploads::resolvePayload( $formId, $schemaForLogic, $payload );
		if ( is_wp_error( $payload ) ) {
			$uploadErrors = $payload->get_error_data();
			return ApiResponse::validation_error( $payload->get_error_message(), is_array( $uploadErrors ) ? ( $uploadErrors['errors'] ?? array() ) : array() );
		}

		// Payments (2.1): price the order on the server, check the coupon and
		// confirm the payment with the gateway before anything is stored.
		$schemaForPricing = $activeSchema['schema'] ?? $activeSchema;
		$order            = $this->priceOrder( $formId, $schemaForPricing, $payload, $request );
		if ( $order instanceof WP_REST_Response ) {
			return $order;
		}
		unset( $payload['_coupon'], $payload['_payment'] );
		$voidPayment = static function () use ( $order ) {
			if ( ! empty( $order['payment'] ) ) {
				/**
				 * The submission failed after the gateway authorised the payment.
				 * Gateways release the hold here.
				 *
				 * @param array $payment Payment details.
				 */
				do_action( 'subtleforms/payment/void', $order['payment'] );
			}
		};

		// Create submission record
		try {
			$submissionId = $this->submissionsRepo->create(
				array(
					'form_id'        => $formId,
					'schema_version' => $formVersion,
					// Passwords are reduced before anything is written, so even
					// an entry that fails validation never holds one as typed.
					'payload'        => self::storablePayload( $payload, $activeSchema['schema'] ?? $activeSchema ),
					'status'         => 'processing',
					'ip_address'     => $ip ?: null,
					'user_agent'     => isset( $_SERVER['HTTP_USER_AGENT'] ) ? sanitize_text_field( wp_unslash( $_SERVER['HTTP_USER_AGENT'] ) ) : null,
				)
			);
		} catch ( \RuntimeException $e ) {
			Logger::error( 'Failed to create submission record: %s', $e->getMessage() );
			// The entry was not saved: release an authorised payment.
			$voidPayment();
			return ApiResponse::server_error( __( 'Failed to create submission record', 'subtleforms' ) );
		}

		// Build submission context
		$context = new SubmissionContext( $formId, $payload );
		$context->setMeta( 'submission_id', $submissionId );
		$context->setMeta( 'schema_version', is_int( $formVersion ) ? $formVersion : null );

		$isPaymentForm   = ! empty( $order['payment'] );
		$paymentMetadata = $order['payment'] ?? null;
		if ( $isPaymentForm ) {
			$context->setMeta( 'payment_intent', $paymentMetadata );
			$context->setMeta( 'is_payment_form', true );
		}

		// Compile and run pipeline
		if ( ! empty( $activeSchema['schema'] ) && is_array( $activeSchema['schema'] ) ) {
			// Inject a virtual webhook action for forms that still use the legacy
			// metadata.integrations.webhooks.url convention, provided no pipeline-
			// level webhook action has been configured yet (avoids double-firing).
			$activeSchema['schema'] = $this->injectLegacyWebhookAction( $activeSchema['schema'] );

			$context->setMeta( 'form_schema', $activeSchema['schema'] );

			try {
				$steps = $this->compiler->compile( $activeSchema['schema'] );
			} catch ( \InvalidArgumentException $e ) {
				$this->submissionsRepo->update( $submissionId, array( 'status' => 'failed' ) );
				$voidPayment();
				Logger::error( 'Schema compilation failed for form %d: %s', $formId, $e->getMessage() );
				return ApiResponse::bad_request( __( 'This form could not be processed. Please contact the site owner.', 'subtleforms' ) );
			}

			try {
				$result = $this->pipeline->run( $steps, $context, $activeSchema['schema'] );
			} catch ( \RuntimeException $e ) {
				$this->submissionsRepo->update( $submissionId, array( 'status' => 'failed' ) );
				$voidPayment();
				Logger::error( 'Pipeline execution failed for submission %d: %s', $submissionId, $e->getMessage() );

				$validationErrors = $context->getMeta( 'validation_errors' );
				if ( is_array( $validationErrors ) && ! empty( $validationErrors ) ) {
					return ApiResponse::validation_error( __( 'Form validation failed', 'subtleforms' ), $validationErrors );
				}

				return ApiResponse::server_error( __( 'Your submission could not be completed. Please try again later.', 'subtleforms' ) );
			} catch ( \Throwable $e ) {
				$this->submissionsRepo->update( $submissionId, array( 'status' => 'failed' ) );
				$voidPayment();
				Logger::error( 'Unexpected error in submission %d: %s', $submissionId, $e->getMessage() );
				return ApiResponse::server_error( __( 'An unexpected error occurred', 'subtleforms' ) );
			}

			if ( ! $result->ok ) {
				$this->submissionsRepo->update( $submissionId, array( 'status' => 'failed' ) );
				$voidPayment();
				Logger::error( 'Pipeline execution failed for submission %d: %s', $submissionId, $result->error );

				$validationErrors = $context->getMeta( 'validation_errors' );
				if ( is_array( $validationErrors ) && ! empty( $validationErrors ) ) {
					return ApiResponse::validation_error( __( 'Form validation failed', 'subtleforms' ), $validationErrors );
				}

				return ApiResponse::server_error( $result->error );
			}

		// Finalize submission status
		$finalSubmission = $this->submissionsRepo->find( $submissionId );
		if ( $finalSubmission && $finalSubmission['status'] === 'saved' ) {
			// Record consent timestamps (GDPR audit) into submission meta. Done
			// for both payment and non-payment forms so consent is always stamped.
			$this->recordConsents( $submissionId, $finalSubmission, $payload, $activeSchema['schema'] ?? $activeSchema );

			if ( ! $isPaymentForm ) {
				$this->submissionsRepo->update( $submissionId, array( 'status' => 'completed' ) );
				if ( ! empty( $order['quote']['coupon'] ) ) {
					// A coupon that made the order free still counts as used.
					$this->finishOrder( $submissionId, $finalSubmission, $order, 'free' );
				}
			} else {
				/**
				 * Capture an authorised payment now that the submission is safely
				 * stored. Return the updated payment array, or a WP_Error.
				 *
				 * @param array $payment      Payment details.
				 * @param int   $submissionId Submission ID.
				 */
				$captured = apply_filters( 'subtleforms/payment/capture', $paymentMetadata, $submissionId );
				if ( is_wp_error( $captured ) ) {
					$order['payment']['status'] = 'failed';
					$order['payment']['error']  = $captured->get_error_message();
					$this->finishOrder( $submissionId, $finalSubmission, $order, 'payment_failed' );
					return ApiResponse::error( 'subtleforms_payment_failed', $captured->get_error_message(), 402 );
				}
				$order['payment'] = is_array( $captured ) ? $captured : $paymentMetadata;
				$status           = in_array( $order['payment']['status'] ?? '', array( 'paid', 'succeeded' ), true ) ? 'completed' : 'payment_pending';
				$this->finishOrder( $submissionId, $finalSubmission, $order, $status );

				/**
				 * Hook: a payment form was submitted.
				 *
				 * @param int               $submissionId    The submission ID.
				 * @param array             $paymentMetadata Payment details.
				 * @param SubmissionContext $context         Full submission context.
				 * @since 1.2.0
				 */
				do_action( 'subtleforms/payment/required', $submissionId, $order['payment'], $context );
			}
			} elseif ( ! $finalSubmission || $finalSubmission['status'] === 'processing' ) {
				Logger::error( 'Submission %d did not reach saved status', $submissionId );
				$this->submissionsRepo->update( $submissionId, array( 'status' => 'failed' ) );
				$voidPayment();
				return ApiResponse::server_error( __( 'Failed to save submission data', 'subtleforms' ) );
			} elseif ( $isPaymentForm ) {
				// Stored with another status (for example spam): the payment
				// is never captured, so release the hold now.
				$voidPayment();
			}

			// Keep the entry's uploaded files (they were pending until now).
			\SubtleForms\Uploads\Uploads::claim( $payload );

			$stored = $this->submissionsRepo->find( $submissionId ) ?: array();

			/**
			 * A submission was stored and its pipeline finished. Integrations
			 * (email marketing, CRM, PDF, WooCommerce) hook here.
			 *
			 * @param int   $submissionId Submission ID.
			 * @param int   $formId       Form ID.
			 * @param array $payload      Sanitised values.
			 * @param array $submission   Stored submission row (status, meta).
			 * @param array $schema       Active form schema.
			 * @since 2.1.0
			 */
			do_action( 'subtleforms/submission/completed', $submissionId, $formId, $payload, $stored, $activeSchema['schema'] ?? $activeSchema );

			/** Legacy extension hook: ( form id, submission row with payload ). */
			do_action( 'subtleforms/submission/saved', $formId, array_merge( $stored, array( 'payload' => $payload ) ) );

			/**
			 * Filter the JSON returned to the browser after a successful submit.
			 * Add `redirect` to send the visitor somewhere (e.g. a checkout).
			 *
			 * @param array $response     { success, submission_id }.
			 * @param int   $submissionId Submission ID.
			 * @param int   $formId       Form ID.
			 * @param array $order        Priced order (quote, coupon, payment) or empty.
			 */
			$response = apply_filters(
				'subtleforms/submit/response',
				array(
					'success'       => true,
					'submission_id' => $submissionId,
					// What to show the visitor: the first conditional
					// confirmation that matches, else the default (2.1).
					'confirmation'  => self::resolveConfirmation( $formId, $activeSchema['schema'] ?? $activeSchema, $payload ),
				),
				$submissionId,
				$formId,
				is_array( $order ) ? $order : array()
			);

			return ApiResponse::success( $response );
		}

		// No schema configured; mark completed
		$this->submissionsRepo->update( $submissionId, array( 'status' => 'completed' ) );

		return ApiResponse::success(
			array(
				'success'       => true,
				'submission_id' => $submissionId,
			),
			200
		);
	}

	/**
	 * The confirmation for this submission, ready for the browser.
	 *
	 * Only display settings are returned (never the conditions themselves).
	 * Merge tags are filled in by the browser, which has the raw answers.
	 *
	 * @param int   $formId  Form ID.
	 * @param mixed $schema  Active schema.
	 * @param array $payload Stored (visible) answers.
	 * @return array|null Null when the form has no confirmation settings.
	 */
	private static function resolveConfirmation( int $formId, $schema, array $payload ): ?array {
		$metadata = is_array( $schema ) && isset( $schema['metadata'] ) && is_array( $schema['metadata'] ) ? $schema['metadata'] : array();
		$picked   = ( new \SubtleForms\Engine\ConditionalLogic() )->pickConfirmation( $metadata, $payload );
		if ( ! $picked ) {
			return null;
		}
		$out = array();
		foreach ( array( 'id', 'type', 'title', 'message', 'redirectUrl', 'allowAnother' ) as $key ) {
			if ( array_key_exists( $key, $picked ) ) {
				$out[ $key ] = $picked[ $key ];
			}
		}

		/**
		 * Filter the confirmation shown after a submission (for example to
		 * translate it).
		 *
		 * @param array $out     { type, title, message, redirectUrl, allowAnother }.
		 * @param int   $formId  Form ID.
		 * @param array $payload Stored answers.
		 * @since 2.1.0
		 */
		$out = apply_filters( 'subtleforms/submit/confirmation', $out, $formId, $payload );
		return is_array( $out ) ? $out : null;
	}

	// ────────────────────────────────────────────────────────────────────
	// Rate limit (inline — no FeatureGate needed for public endpoint)
	// ────────────────────────────────────────────────────────────────────

	/**
	 * Guard rate limit for request.
	 */
	/**
	 * Count a single submitter's non-spam submissions for a form.
	 *
	 * The caller supplies exactly one identity predicate so that logged-in users
	 * are counted by account and guests by IP. Combining the two would make
	 * `user_id = 0` match every guest submission on the form.
	 *
	 * @param int        $formId    Form ID.
	 * @param string     $predicate SQL predicate with a single placeholder, e.g. 'user_id = %d'.
	 * @param int|string $value     Value bound to the predicate placeholder.
	 * @return int Number of matching submissions.
	 */
	/**
	 * Price the order, check the coupon and confirm the payment.
	 *
	 * @param int             $formId  Form ID.
	 * @param mixed           $schema  Active schema.
	 * @param array           $payload Sanitized payload with calculations applied.
	 * @param WP_REST_Request $request Incoming request.
	 * @return array{quote:?array,coupon:?array,payment:?array}|WP_REST_Response
	 */
	private function priceOrder( int $formId, $schema, array $payload, WP_REST_Request $request ) {
		$none = array(
			'quote'   => null,
			'coupon'  => null,
			'payment' => null,
		);
		if ( ! Pricing::isPriced( $schema ) ) {
			return $none;
		}

		$priced = Pricing::quote( $schema, $payload );
		if ( ! empty( $priced['formula_error'] ) ) {
			return ApiResponse::error(
				'subtleforms_formula_invalid',
				__( 'This total could not be calculated, so the payment was not taken.', 'subtleforms' ),
				422
			);
		}

		/**
		 * Whether another system takes this form's payment (for example the
		 * WooCommerce checkout in SubtleForms Pro). When true, SubtleForms does
		 * not price, verify or charge; the handler finishes the order on
		 * `subtleforms/submission/completed`.
		 *
		 * @param bool  $external Default false.
		 * @param mixed $schema   Active schema.
		 * @param int   $formId   Form ID.
		 */
		if ( apply_filters( 'subtleforms/payments/external', false, $schema, $formId ) ) {
			// Hand the visitor's coupon code on (it is removed from the payload
			// before the entry is stored); the handler validates it itself.
			$none['external']    = true;
			$none['coupon_code'] = CouponsRepository::normalizeCode( (string) ( $payload['_coupon'] ?? '' ) );
			return $none;
		}

		// The coupon comes from the summary's coupon box or a Coupon field.
		$code = (string) ( $payload['_coupon'] ?? '' );
		if ( '' === $code ) {
			foreach ( Pricing::fields( $schema ) as $f ) {
				if ( ( $f['type'] ?? '' ) === 'payment_coupon' && ! empty( $f['key'] ) && ! empty( $payload[ $f['key'] ] ) ) {
					$code = (string) $payload[ $f['key'] ];
					break;
				}
			}
		}
		$code = CouponsRepository::normalizeCode( $code );

		$quote    = Pricing::quote( $schema, $payload );
		$coupon   = null;
		$customer = CouponsRepository::customerKey( $schema, $payload );
		if ( '' !== $code ) {
			$checked = CouponsRepository::validate( $code, $formId, (float) $quote['subtotal'], $customer );
			if ( is_wp_error( $checked ) ) {
				return ApiResponse::error( 'subtleforms_coupon_invalid', $checked->get_error_message(), 422 );
			}
			$coupon = $checked;
			$quote  = Pricing::quote( $schema, $payload, $coupon );
		}

		$order = array(
			'quote'    => $quote,
			'coupon'   => $coupon,
			'payment'  => null,
			'customer' => $customer,
		);
		if ( $quote['total'] <= 0 ) {
			return $order;
		}

		$settings = get_option( 'subtleforms_settings', array() );
		$mode     = is_array( $settings ) ? (string) ( $settings['ext_payments_mode'] ?? 'test' ) : 'test';

		/**
		 * Confirm the visitor's payment for this order.
		 *
		 * Gateways return an array with `status` ("authorized", "paid" or
		 * "pending"), `gateway` and `transaction_id`, or a WP_Error to reject
		 * the submission. Returning null means no gateway handled it, and the
		 * entry is stored as "payment pending" for offline payment.
		 *
		 * @param array|\WP_Error|null $result  Default null.
		 * @param array                $quote   Server-computed order.
		 * @param array                $payload Submitted values (includes `_payment`).
		 * @param int                  $formId  Form ID.
		 * @param mixed                $schema  Active schema.
		 */
		$verified = apply_filters( 'subtleforms/payment/verify', null, $quote, $payload, $formId, $schema );
		if ( is_wp_error( $verified ) ) {
			return ApiResponse::error( $verified->get_error_code(), $verified->get_error_message(), 402 );
		}

		$hasCard = false;
		foreach ( Pricing::fields( $schema ) as $f ) {
			if ( ( $f['type'] ?? '' ) === 'payment_card' ) {
				$hasCard = true;
				break;
			}
		}
		if ( null === $verified && $hasCard ) {
			return ApiResponse::error( 'subtleforms_payment_unavailable', __( 'Online payment is not available right now. Please contact the site owner.', 'subtleforms' ), 402 );
		}

		$verified         = is_array( $verified ) ? $verified : array();
		$order['payment'] = array(
			'status'         => (string) ( $verified['status'] ?? 'pending' ),
			'gateway'        => $verified['gateway'] ?? null,
			'transaction_id' => $verified['transaction_id'] ?? null,
			'amount'         => $quote['total'],
			'currency'       => $quote['currency'],
			'mode'           => $mode,
			'created_at'     => current_time( 'mysql', true ),
		);
		return $order;
	}

	/**
	 * Store the order on the submission and count the coupon.
	 *
	 * @param int    $submissionId Submission ID.
	 * @param array  $submission   Stored submission.
	 * @param array  $order        Result of priceOrder().
	 * @param string $status       Final submission status.
	 */
	private function finishOrder( int $submissionId, array $submission, array $order, string $status ): void {
		$meta = is_array( $submission['meta'] ?? null ) ? $submission['meta'] : array();
		if ( ! empty( $order['quote'] ) ) {
			$meta['order'] = $order['quote'];
		}
		if ( ! empty( $order['payment'] ) ) {
			$meta['payment'] = $order['payment'];
		} elseif ( 'free' === $status ) {
			$meta['payment'] = array(
				'status'   => 'free',
				'amount'   => 0,
				'currency' => $order['quote']['currency'] ?? '',
			);
			$status          = 'completed';
		}
		$this->submissionsRepo->update(
			$submissionId,
			array(
				'status' => $status,
				'meta'   => $meta,
			)
		);
		if ( ! empty( $order['coupon']['id'] ) && in_array( $status, array( 'completed', 'payment_pending' ), true ) ) {
			CouponsRepository::recordUse( (int) $order['coupon']['id'], (string) ( $order['customer'] ?? '' ), $submissionId );
		}
	}

	/**
	 * Recompute every Calculation field from the submitted values.
	 *
	 * @param array $payload Sanitized payload.
	 * @param mixed $schema  Active schema.
	 * @return array
	 */
	public static function applyCalculations( array $payload, $schema ): array {
		if ( ! is_array( $schema ) || empty( $schema['fields'] ) || ! is_array( $schema['fields'] ) ) {
			return $payload;
		}

		$calcs = array();
		$walk  = static function ( array $fields ) use ( &$walk, &$calcs ) {
			foreach ( $fields as $field ) {
				if ( ! is_array( $field ) ) {
					continue;
				}
				$config = isset( $field['config'] ) && is_array( $field['config'] ) ? array_merge( $field, $field['config'] ) : $field;
				if ( ( $field['type'] ?? '' ) === 'calculation' && ! empty( $config['key'] ) && ! empty( $config['formula'] ) ) {
					$calcs[] = $config;
				}
				foreach ( array( 'fields', 'children' ) as $nested ) {
					if ( ! empty( $field[ $nested ] ) && is_array( $field[ $nested ] ) ) {
						$walk( $field[ $nested ] );
					}
				}
				if ( ! empty( $field['columns'] ) && is_array( $field['columns'] ) ) {
					foreach ( $field['columns'] as $column ) {
						if ( is_array( $column ) ) {
							$walk( $column );
						}
					}
				}
			}
		};
		$walk( $schema['fields'] );

		// Two passes let one calculation reference another.
		for ( $pass = 0; $pass < 2; $pass++ ) {
			foreach ( $calcs as $calc ) {
				$result                      = \SubtleForms\Engine\Formula::evaluate(
					(string) $calc['formula'],
					$payload,
					isset( $calc['decimals'] ) ? (int) $calc['decimals'] : 2
				);
				$payload[ $calc['key'] ] = null === $result ? \SubtleForms\Engine\Formula::ERROR : $result;
			}
		}

		return $payload;
	}

	/**
	 * A copy of the answers that is safe to write to the database.
	 *
	 * @param array $payload Answers.
	 * @param mixed $schema  Form schema.
	 * @return array
	 */
	public static function storablePayload( array $payload, $schema ): array {
		if ( ! is_array( $schema ) ) {
			return $payload;
		}
		foreach ( \SubtleForms\Support\FieldMapper::fields( $schema ) as $entry ) {
			if ( \SubtleForms\Support\EntryValues::isSecret( $entry['field'] ) && array_key_exists( $entry['key'], $payload ) ) {
				$payload[ $entry['key'] ] = \SubtleForms\Support\EntryValues::passwordForStorage( $payload[ $entry['key'] ], $entry['field'] );
			}
		}
		foreach ( $payload as $key => $value ) {
			if ( \SubtleForms\Engine\Formula::ERROR === $value ) {
				$payload[ $key ] = null;
			}
		}
		return $payload;
	}

	/**
	 * Re-apply rich-text sanitization to values whose schema type allows markup.
	 *
	 * @param array $payload   Strictly sanitized payload.
	 * @param array $rawValues Original untouched submitted values.
	 * @param array $schema    Resolved form schema.
	 * @return array Payload with rich_text keys restored.
	 */
	private function restoreRichTextValues( array $payload, $rawValues, $schema ): array {
		if ( ! is_array( $rawValues ) || empty( $rawValues ) || ! is_array( $schema ) ) {
			return $payload;
		}

		$richKeys = array();
		self::collectFieldKeysOfType( $schema['fields'] ?? array(), 'rich_text', $richKeys );

		foreach ( $richKeys as $key ) {
			if ( array_key_exists( $key, $rawValues ) ) {
				$payload[ $key ] = Sanitizer::sanitizeRichText( $rawValues[ $key ] );
			}
		}

		// Passwords are taken as typed (tag stripping would change them) and
		// are hashed or reduced to "provided" by the save step; they are never
		// stored or emailed as typed.
		$passwordKeys = array();
		self::collectFieldKeysOfType( $schema['fields'] ?? array(), 'password', $passwordKeys );
		foreach ( $passwordKeys as $key ) {
			if ( array_key_exists( $key, $rawValues ) && is_scalar( $rawValues[ $key ] ) ) {
				$payload[ $key ] = (string) $rawValues[ $key ];
			}
		}

		return $payload;
	}

	/**
	 * Record consent timestamps into submission meta for GDPR auditability.
	 *
	 * Walks the schema for `consent` fields, and for each one the submitter
	 * accepted (truthy value in the payload), stamps a consent record with the
	 * field key, label, Privacy Policy URL and an ISO-8601 timestamp. Stored
	 * under `meta.consents` so the payload shape is unchanged but the consent
	 * is auditable per submission.
	 *
	 * @param int   $submissionId Submission ID.
	 * @param array $submission   Final submission row (for current meta).
	 * @param array $payload       Submitted values keyed by field key.
	 * @param array $schema        Resolved form schema.
	 * @return void
	 */
	private function recordConsents( int $submissionId, array $submission, array $payload, $schema ): void {
		if ( ! is_array( $schema ) ) {
			return;
		}

		$consent_fields = array();
		$this->collectConsentFields( $schema['fields'] ?? array(), $consent_fields );

		if ( empty( $consent_fields ) ) {
			return;
		}

		$consents = array();
		$now_iso  = gmdate( 'c' );

		foreach ( $consent_fields as $field ) {
			$key = $field['key'] ?? '';
			if ( '' === $key || ! array_key_exists( $key, $payload ) ) {
				continue;
			}

			$value = $payload[ $key ];
			// A checkbox/consent value is accepted when truthy. Booleans,
			// "on", "1", and "true" all count; an unchecked box is false/empty.
			$accepted = is_bool( $value ) ? $value : filter_var( $value, FILTER_VALIDATE_BOOLEAN );

			$consents[] = array(
				'key'              => $key,
				'label'            => $field['label'] ?? $field['config']['checkboxLabel'] ?? $key,
				'accepted'         => $accepted,
				'timestamp'         => $accepted ? $now_iso : null,
				'privacyPolicyUrl' => $field['config']['privacyPolicyUrl'] ?? ( $field['privacyPolicyUrl'] ?? '' ),
			);
		}

		if ( empty( $consents ) ) {
			return;
		}

		$current_meta = $submission['meta'] ?? array();
		if ( ! is_array( $current_meta ) ) {
			$current_meta = array();
		}
		$current_meta['consents'] = $consents;

		$this->submissionsRepo->update(
			$submissionId,
			array( 'meta' => $current_meta )
		);
	}

	/**
	 * Walk a schema field list, collecting `consent` fields with their config.
	 *
	 * @param array $fields Field list, possibly nested.
	 * @param array $out    Collected consent field configs, by reference.
	 */
	private function collectConsentFields( $fields, array &$out ): void {
		if ( ! is_array( $fields ) ) {
			return;
		}

		foreach ( $fields as $field ) {
			if ( ! is_array( $field ) ) {
				continue;
			}

			if ( ( $field['type'] ?? '' ) === 'consent' ) {
				$out[] = array(
					'key'   => (string) ( $field['key'] ?? $field['config']['key'] ?? '' ),
					'label' => $field['label'] ?? $field['config']['label'] ?? '',
					'config' => $field['config'] ?? array(),
				);
			}

			// Recurse into nested containers.
			foreach ( array( 'fields', 'children', 'columns' ) as $child_key ) {
				if ( ! empty( $field[ $child_key ] ) ) {
					if ( 'columns' === $child_key && is_array( $field[ $child_key ] ) ) {
						foreach ( $field[ $child_key ] as $col ) {
							$this->collectConsentFields( $col, $out );
						}
					} else {
						$this->collectConsentFields( $field[ $child_key ], $out );
					}
				}
			}
		}
	}

	/**
	 * Walk a schema field list, collecting keys of a given type.
	 *
	 * @param array  $fields Field list, possibly nested.
	 * @param string $type   Field type to match.
	 * @param array  $out    Collected keys, by reference.
	 */
	private static function collectFieldKeysOfType( $fields, string $type, array &$out ): void {
		if ( ! is_array( $fields ) ) {
			return;
		}

		foreach ( $fields as $field ) {
			if ( ! is_array( $field ) ) {
				continue;
			}

			if ( ( $field['type'] ?? '' ) === $type && ! empty( $field['key'] ) ) {
				$out[] = (string) $field['key'];
			}

			if ( ! empty( $field['fields'] ) ) {
				self::collectFieldKeysOfType( $field['fields'], $type, $out );
			}
			if ( ! empty( $field['children'] ) ) {
				self::collectFieldKeysOfType( $field['children'], $type, $out );
			}

			// Column containers hold a list per column, so this level is an
			// array of field lists rather than a field list. SchemaCompiler
			// normalizes the same three shapes; missing this one here meant a
			// rich_text field inside a column kept the stripped value.
			if ( ! empty( $field['columns'] ) && is_array( $field['columns'] ) ) {
				foreach ( $field['columns'] as $column ) {
					self::collectFieldKeysOfType( $column, $type, $out );
				}
			}
		}
	}

	private function countSubmissionsBy( int $formId, string $predicate, $value ): int {
		global $wpdb;

		$table_name = $wpdb->prefix . 'subtleforms_submissions';

		// phpcs:disable PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare, WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Table name is from $wpdb->prefix. $predicate is one of two fixed internal strings, each carrying exactly one placeholder, so the sniff's count is short by one; both values are bound by prepare().
		return (int) $wpdb->get_var(
			$wpdb->prepare(
				"SELECT COUNT(*) FROM {$table_name} WHERE form_id = %d AND {$predicate} AND status != 'spam' AND status != 'trash'",
				$formId,
				$value
			)
		);
		// phpcs:enable PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare, WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
	}

	private function guardRateLimit( WP_REST_Request $request ): ?WP_REST_Response {
		$userId = get_current_user_id() ?: null;
		$ip     = isset( $_SERVER['REMOTE_ADDR'] )
			? sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) )
			: '0.0.0.0';
		$route  = $request->get_route();
		$method = $request->get_method();

		$policy = RateLimiter::policy( $route, $method );
		$key    = RateLimiter::buildKey( $route, $method, $userId, $ip );
		$result = RateLimiter::check( $key, $policy['limit'], $policy['window'] );

		if ( ! $result['allowed'] ) {
			$headers = RateLimiter::headers( $result, $policy['limit'] );
			return ApiResponse::rate_limited(
				'Too many requests. Please try again later.',
				$result['retry_after'],
				array(),
				$headers
			);
		}

		return null;
	}

        /**
         * Compatibility bridge for legacy webhook configuration.
         *
         * If the form schema stores a webhook URL in
         * metadata.integrations.webhooks.url (the pre-1.9.0 convention) and no
         * schema-level webhook action has been configured, inject a virtual
         * webhook action so the pipeline still delivers the webhook.
         *
         * @param  array $schema  Active schema array (may be mutated).
         * @return array          Schema with virtual action injected (or unchanged).
         */
        private function injectLegacyWebhookAction( array $schema ): array {
                $legacy_url = $schema['metadata']['integrations']['webhooks']['url'] ?? '';
                if ( empty( $legacy_url ) || ! is_string( $legacy_url ) ) {
                        return $schema;
                }

                // Sanitize the URL stored in metadata.
                $legacy_url = esc_url_raw( $legacy_url );
                if ( ! wp_http_validate_url( $legacy_url ) ) {
                        return $schema;
                }

                // Check if a pipeline-level webhook action already exists — no double-fire.
                $actions = $schema['actions'] ?? array();
                foreach ( $actions as $action ) {
                        if ( isset( $action['type'] ) && $action['type'] === 'webhook' ) {
                                return $schema;
                        }
                }

                // Inject virtual webhook action (full payload, POST, no custom headers or signing).
                Logger::info( '[SubtleForms] Legacy webhook compatibility used | url=%s', $legacy_url );

                $schema_version        = $schema['schema_version'] ?? '0';
                $schema['actions'][]   = array(
                        'id'       => 'legacy-compat-' . $schema_version,
                        'type'     => 'webhook',
                        'enabled'  => true,
                        'settings' => array(
                                'url'          => $legacy_url,
                                'method'       => 'POST',
                                'payload_mode' => 'full',
                                'headers'      => array(),
                                'signing'      => array( 'enabled' => false, 'secret' => '' ),
                        ),
                );

                return $schema;
        }
}
