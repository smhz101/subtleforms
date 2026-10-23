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

use SubtleForms\Fields\ActionHooks;
use SubtleForms\Support\Captcha\FieldCaptcha;

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
use SubtleForms\Security\RateLimiter;
use SubtleForms\Analytics\SpamStats;
use SubtleForms\Engine\SpamProtection;
use WP_REST_Request;
use WP_REST_Response;

/**
 * REST API controller for public form submissions.
 */
final class PublicSubmitApi {

	/**
	 * Whether the submission being handled is a classic (no JavaScript) post.
	 *
	 * @var bool
	 */
	private $classicPost = false;

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
		add_action( 'template_redirect', array( $this, 'handleClassicPost' ) );
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
	 * A block with AJAX turned off posts the form to the page.
	 */
	public function handleClassicPost(): void {
		$method = isset( $_SERVER['REQUEST_METHOD'] ) ? sanitize_key( wp_unslash( $_SERVER['REQUEST_METHOD'] ) ) : '';
		// Public form posts carry no nonce, like the REST submit route: visitors have
		// no nonce so cached pages keep working (2.3.9). The post goes through the
		// same spam, rate limit and validation checks as an AJAX submit.
		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Public form; see above.
		if ( 'post' !== $method || empty( $_POST['subtleforms_classic'] ) ) {
			return;
		}
		// phpcs:ignore WordPress.Security.NonceVerification.Missing, WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- Public form; each answer is sanitized and validated by submit_form().
		$built = self::classicSubmission( wp_unslash( $_POST ) );
		if ( $built['form_id'] < 1 ) {
			return;
		}
		$request = new WP_REST_Request( 'POST', '/subtleforms/v1/submit' );
		$request->set_header( 'Content-Type', 'application/json' );
		$request->set_body( (string) wp_json_encode( $built ) );
		$request->set_param( 'form_id', $built['form_id'] );
		$this->classicPost = true;
		$response          = $this->submit_form( $request );
		$outcome           = ClassicResult::outcome( $response->get_status(), $response->get_data(), $built['form_id'], $built['data'] );

		// Only a submission that went through follows a redirect confirmation.
		if ( $outcome['ok'] && '' !== $outcome['redirect'] ) {
			if ( $outcome['configured'] ) {
				// Merge tags are filled here, as the browser does for AJAX.
				$form                = $this->formsRepo->find( $built['form_id'] );
				$outcome['redirect'] = ClassicResult::fillTags(
					$outcome['redirect'],
					$outcome['values'],
					is_array( $form ) ? (string) ( $form['title'] ?? '' ) : '',
					(int) ( $outcome['body']['data']['submission_id'] ?? 0 )
				);
				// The form's confirmation may send visitors to another site.
				ClassicResult::allowHostOf( $outcome['redirect'] );
			}
			wp_safe_redirect( $outcome['redirect'] );
			exit;
		}

		// Otherwise return to the page, which shows the confirmation, or the
		// errors with the visitor's answers.
		$page = wp_get_referer();
		if ( ! is_string( $page ) || '' === $page ) {
			$page = home_url( '/' );
		}
		wp_safe_redirect( ClassicResult::returnUrl( $page, ClassicResult::store( $outcome ) ) );
		exit;
	}

	/**
	 * Count a submission the rate limit turned away, for a form that exists.
	 * Unknown form IDs are not counted, so a bot cannot fill the table.
	 *
	 * @param WP_REST_Request $request Request.
	 */
	private function countRateLimited( WP_REST_Request $request ): void {
		$formId = absint( $request->get_param( 'form_id' ) );
		if ( $formId > 0 && $this->formsRepo->find( $formId ) ) {
			SpamStats::blocked( $formId, 'rate_limit' );
		}
	}

	/**
	 * The schema whose spam settings apply: the published one, or the draft
	 * for a preview. Null when it cannot be read (the old behaviour applies).
	 *
	 * @param int  $formId    Form ID.
	 * @param bool $isPreview Whether this is a builder preview.
	 * @return array|null
	 */
	private function spamSchema( int $formId, bool $isPreview ): ?array {
		try {
			if ( $isPreview ) {
				$draft = $this->formsRepo->getDraftSchema( $formId );
				if ( is_array( $draft ) ) {
					return $draft;
				}
			}
			$active = $this->formsRepo->loadSchemaVersion( $formId );
		} catch ( \RuntimeException $e ) {
			return null;
		}
		return is_array( $active ) ? ( $active['schema'] ?? $active ) : null;
	}

	/**
	 * The JSON body a classic form post becomes.
	 *
	 * @param array $post Request body.
	 * @return array{form_id: int, data: array}
	 */
	public static function classicSubmission( array $post ): array {
		$data = isset( $post['data'] ) && is_array( $post['data'] ) ? $post['data'] : array();
		return array(
			'form_id' => absint( $post['subtleforms_form_id'] ?? 0 ),
			'data'    => $data,
		);
	}

	/**
	 * Submit a form (public endpoint).
	 */
	public function submit_form( WP_REST_Request $request ): WP_REST_Response {
		// Rate limiting
		$rateLimitResponse = $this->guardRateLimit( $request );
		if ( $rateLimitResponse ) {
			$this->countRateLimited( $request );
			return $rateLimitResponse;
		}

		$ip = \SubtleForms\Security\ClientIp::get();

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
			$previewDecision = self::previewDecision(
				$validated,
				is_user_logged_in() && current_user_can( 'manage_options' )
			);
			if ( 'forbidden' === $previewDecision ) {
				return ApiResponse::forbidden( __( 'Preview submissions are only available to administrators.', 'subtleforms' ) );
			}
			$isPreview = 'preview' === $previewDecision;
		} catch ( ValidationException $e ) {
			return ApiResponse::validation_error( $e->getMessage(), $e->getFields() );
		}

	$payload = $validated['data'] ?? array();
	$payload = is_array( $payload ) ? Sanitizer::sanitizeArrayDeep( $payload ) : array();

		// Verify the form exists before any spam check, so a missing, draft or
		// trashed form always answers 404. Guests only reach published forms. A
		// logged-in admin (the builder preview) may store an entry on a draft.
		$form    = $this->formsRepo->find( $formId );
		$isAdmin = is_user_logged_in() && current_user_can( 'manage_options' );
		if ( ! $form || ( ( $form['status'] ?? '' ) !== 'published' && ! $isAdmin ) ) {
			return ApiResponse::not_found( __( 'Form not found', 'subtleforms' ) );
		}

		// Spam protection: the hidden trap field ("website_url", which real
		// visitors never see) and the time trap. Each form has its own switch
		// for both (2.6.0); a form saved earlier keeps its old behaviour. A
		// blocked submission gets the same "Thank you." as a real one and
		// nothing is stored, so a bot does not learn it was caught and retry.
		// A site admin testing a form (builder preview) skips the time trap,
		// since the preview has no server-issued token.
		$protection = SpamProtection::for_form( $this->spamSchema( $formId, ! empty( $isPreview ) ) );
		// A classic post cannot refresh an old token, so it may use one once.
		$protection['acceptStale'] = $this->classicPost;
		$skipTimeTrap              = current_user_can( 'manage_options' );
		// A classic post cannot trade the page ticket in the browser, so the
		// server trades it here, before the checks.
		if ( $this->classicPost && null !== SpamProtection::ticket_time( $payload[ SpamProtection::TIME_FIELD ] ?? null, $formId ) ) {
			$payload[ SpamProtection::TIME_FIELD ] = (string) SpamProtection::exchange_ticket( $payload[ SpamProtection::TIME_FIELD ], $formId );
		}
		$spamReason                = SpamProtection::block_reason(
			$payload,
			$formId,
			$protection,
			$skipTimeTrap
		);
		if ( 'time_token_expired' === $spamReason || 'time_ticket' === $spamReason ) {
			// Not spam: the page was open or cached for hours, or the browser
			// sent the page ticket before trading it. Hand back a submit token
			// so the browser can send the same answers again.
			$fresh = SpamProtection::refresh_token( $payload[ SpamProtection::TIME_FIELD ] ?? null, $formId );
			return new WP_REST_Response(
				array(
					'error' => array(
						'code'    => 'subtleforms_token_expired',
						'message' => __( 'This form was open for a long time. Please send it again.', 'subtleforms' ),
						'meta'    => array( 'spam_token' => (string) $fresh ),
					),
				),
				409
			);
		}
		$timeTokenToClaim = ( null === $spamReason && ! empty( $protection['timeTrap'] ) && ! $skipTimeTrap && empty( $isPreview ) )
			? ( $payload[ SpamProtection::TIME_FIELD ] ?? null )
			: null;
		if ( null !== $spamReason ) {
			Logger::info( 'Spam blocked (form %d): %s', $formId, $spamReason );
			if ( empty( $isPreview ) ) {
				SpamStats::blocked( $formId, $spamReason );
			}
			return ApiResponse::success(
				array(
					'success' => true,
					'message' => __( 'Thank you.', 'subtleforms' ),
				)
			);
		}

		// CAPTCHA is checked after the schema is loaded, so a field can use its own provider.

		// Check submission limit
		$settings = get_option( 'subtleforms_settings', array() );
		if ( empty( $isPreview ) && ! empty( $settings['submission_limit_enabled'] ) ) {
			$limit   = isset( $settings['submission_limit'] ) ? (int) $settings['submission_limit'] : 1;
			$user_id = get_current_user_id();

			// Identify the submitter by account when logged in, otherwise by IP.
			// These must never be OR'd together: user_id is 0 for every guest, so
			// matching on it would count all guests as a single submitter and lock
			// the form for everyone once the limit is reached.
			$count = null;

			if ( $user_id > 0 ) {
				// The user_id column arrives with the schema upgrade (2.7.1).
				// Until it has run there is nothing to count by account, so the
				// query is not sent (it would fail and read as zero).
				if ( \SubtleForms\Privacy\PrivacyLookup::hasUserIdColumn() ) {
					$count = $this->countSubmissionsBy( $formId, 'user_id = %d', $user_id );
				}
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
			if ( ! empty( $isPreview ) ) {
				$draft = $this->formsRepo->getDraftSchema( $formId );
				if ( is_array( $draft ) ) {
					$activeSchema['schema'] = $draft;
				}
			}
		} catch ( \RuntimeException $e ) {
			Logger::error( 'Submission Error: %s', $e->getMessage() );
			return ApiResponse::server_error( __( 'This form is temporarily unavailable. Please try again later.', 'subtleforms' ) );
		}
		$formVersion = $activeSchema['version'] ?? null;
		$schemaForCaptcha = $activeSchema['schema'] ?? $activeSchema;
		if ( is_array( $schemaForCaptcha ) ) {
			ActionHooks::fire(
				$schemaForCaptcha,
				array(
					'when'    => 'submit',
					'form_id' => $formId,
					'payload' => $payload,
				)
			);
			// One check per provider: the browser sends one token per provider,
			// and a token can be verified only once (2.4.0).
			$captchaFields = FieldCaptcha::onePerProvider( FieldCaptcha::fields( $schemaForCaptcha ) );
			if ( $captchaFields ) {
				foreach ( $captchaFields as $captchaField ) {
					$provider = FieldCaptcha::provider( $captchaField );
					$settings = array();
					if ( $this->captchaManager && '' !== $provider ) {
						$settings[ $provider ] = $this->captchaManager->keysFor( $provider );
					}
					$resolved = FieldCaptcha::resolve( $captchaField, $settings );
					if ( ! $resolved['ready'] || ! $this->captchaManager ) {
						return ApiResponse::bad_request( $resolved['warning'] );
					}
					$verification = $this->captchaManager->verifyField( $resolved['provider'], $resolved['secret'], $payload );
					if ( empty( $verification['success'] ) ) {
						if ( empty( $isPreview ) ) {
							SpamStats::blocked( $formId, 'captcha_failed' );
						}
						return ApiResponse::bad_request(
							$verification['error'] ?? __( 'CAPTCHA verification failed.', 'subtleforms' )
						);
					}
				}
			} elseif ( $this->captchaManager && $this->captchaManager->isEnabled() && $this->captchaManager->isConfigured() ) {
				$verification = $this->captchaManager->verify( $payload );
				if ( empty( $verification['success'] ) ) {
					if ( empty( $isPreview ) ) {
						SpamStats::blocked( $formId, 'captcha_failed' );
					}
					return ApiResponse::bad_request(
						$verification['error'] ?? __( 'CAPTCHA verification failed.', 'subtleforms' )
					);
				}
			}
		}

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

		// Computed fields (Pro Calculation) are worked out on the server so a
		// visitor cannot post a tampered total.
		$payload = self::applyComputedValues( $payload, $activeSchema['schema'] ?? $activeSchema );

		// Answers in the shape the form stores: Hidden field values worked
		// out on the server, display-only payment fields dropped, websites,
		// email lists and phone numbers tidied (FLD2-16, PAY2-04, FB-15).
		// Conditional logic reads the same answers before they are tidied,
		// as the browser does, so a rule for "example.com" still matches a
		// website stored as https://example.com (review of PR #28).
		$logicValues = \SubtleForms\Engine\FieldValidator::prepare( $activeSchema['schema'] ?? $activeSchema, $payload, false );
		$payload     = \SubtleForms\Engine\FieldValidator::prepare( $activeSchema['schema'] ?? $activeSchema, $payload );

		// Fields from an add-on that is not active are not on the live form.
		$payload     = \SubtleForms\Fields\AddonFieldTypes::dropMissingAnswers( $payload, $activeSchema['schema'] ?? $activeSchema );
		$logicValues = \SubtleForms\Fields\AddonFieldTypes::dropMissingAnswers( $logicValues, $activeSchema['schema'] ?? $activeSchema );

		// Conditional logic (2.1): answers to fields the visitor could not see
		// (hidden fields and skipped steps) are never stored, priced or sent.
		$schemaForLogic = $activeSchema['schema'] ?? $activeSchema;
		if ( is_array( $schemaForLogic ) ) {
			$conditions  = new \SubtleForms\Engine\ConditionalLogic();
			$payload     = $conditions->visiblePayload( $schemaForLogic, $payload, $logicValues );
			$logicValues = $conditions->visiblePayload( $schemaForLogic, $logicValues );
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
		$order            = $this->priceOrder( $formId, $schemaForPricing, $payload, $request, $logicValues );
		if ( $order instanceof WP_REST_Response ) {
			return $order;
		}
		unset( $payload['_coupon'], $payload['_payment'] );
		// An order that was priced but not stored is handed back as
		// abandoned, so the add-on that priced it can release what it holds.
		$voidPayment = function () use ( $order ) {
			if ( ! empty( $order['payment'] ) ) {
				$this->finishOrder( 0, array(), $order, 'abandoned' );
			}
		};

		// A time token is good for one submission. A repeat is dropped like
		// any other spam. The mark is released again if the entry is rejected
		// or fails, so a visitor can correct a field and send again.
		$claimedToken = null;
		if ( is_string( $timeTokenToClaim ) && '' !== $timeTokenToClaim ) {
			$tokenInfo = SpamProtection::token_info( $timeTokenToClaim, $formId );
			if ( ! SpamProtection::claim_token( $timeTokenToClaim, $tokenInfo['time'] ?? null ) ) {
				$voidPayment();
				SpamStats::blocked( $formId, 'time_token_reused' );
				return ApiResponse::success(
					array(
						'success' => true,
						'message' => __( 'Thank you.', 'subtleforms' ),
					)
				);
			}
			$claimedToken = $timeTokenToClaim;
		}

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
			SpamProtection::release_token( $claimedToken );
			// The entry was not saved: release an authorised payment.
			$voidPayment();
			return ApiResponse::server_error( __( 'Failed to create submission record', 'subtleforms' ) );
		}

		// Remember which account sent the entry, for the per-user limit and
		// for privacy requests. Only once the column exists.
		if ( get_current_user_id() > 0 && \SubtleForms\Privacy\PrivacyLookup::hasUserIdColumn() ) {
			global $wpdb;
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Single column update on the entry just created.
			$wpdb->update( $wpdb->prefix . 'subtleforms_submissions', array( 'user_id' => get_current_user_id() ), array( 'id' => (int) $submissionId ), array( '%d' ), array( '%d' ) );
		}

		// Build submission context
		$context = new SubmissionContext( $formId, $payload );
		$context->setMeta( 'submission_id', $submissionId );
		// Answers as typed, for conditions on actions and steps.
		$context->setMeta( 'logic_payload', $logicValues );
		$context->setMeta( 'schema_version', is_int( $formVersion ) ? $formVersion : null );
		$context->setMeta( 'order_currency', (string) ( $order['quote']['currency'] ?? '' ) );

		// What a webhook can send about the visit and the payment (2.5.0).
		$referer = function_exists( 'wp_get_raw_referer' ) ? wp_get_raw_referer() : '';
		$context->setMeta( 'request_ip', (string) $ip );
		$context->setMeta( 'request_user_agent', isset( $_SERVER['HTTP_USER_AGENT'] ) ? sanitize_text_field( wp_unslash( $_SERVER['HTTP_USER_AGENT'] ) ) : '' );
		$context->setMeta( 'request_page_url', is_string( $referer ) ? esc_url_raw( $referer ) : '' );
		$context->setMeta( 'request_user_id', get_current_user_id() );
		$context->setMeta( 'entry_status', ! empty( $order['payment'] ) ? 'payment_pending' : 'completed' );
		$context->setMeta(
			'payment_info',
			array(
				'amount'   => (float) ( $order['quote']['total'] ?? 0 ),
				'currency' => (string) ( $order['quote']['currency'] ?? '' ),
				'status'   => (string) ( $order['payment']['status'] ?? ( ! empty( $order['quote'] ) ? 'free' : '' ) ),
			)
		);

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
				if ( ! empty( $isPreview ) ) {
					$steps = array_values(
						array_filter(
							$steps,
							static function ( $step ) {
								return 'save' === $step->action()->id();
							}
						)
					);
				}
			} catch ( \InvalidArgumentException $e ) {
				$this->submissionsRepo->update( $submissionId, array( 'status' => 'failed' ) );
				$voidPayment();
				Logger::error( 'Schema compilation failed for form %d: %s', $formId, $e->getMessage() );
				return ApiResponse::bad_request( __( 'This form could not be processed. Please contact the site owner.', 'subtleforms' ) );
			}

			// An order that still has to be settled is settled after the entry
			// is saved. Emails, webhooks and integrations wait for that result,
			// so nobody gets a receipt for a payment that then fails (PAY-04).
			$deferActions = $isPaymentForm && 'authorized' === ( $paymentMetadata['status'] ?? '' );
			$laterSteps   = array();
			if ( $deferActions ) {
				$laterSteps = array_values(
					array_filter(
						$steps,
						static function ( $step ) {
							return 'save' !== $step->action()->id();
						}
					)
				);
				$steps      = array_values(
					array_filter(
						$steps,
						static function ( $step ) {
							return 'save' === $step->action()->id();
						}
					)
				);
			}

			try {
				$result = $this->pipeline->run( $steps, $context, $activeSchema['schema'] );
			} catch ( \RuntimeException $e ) {
				$voidPayment();
				$validationErrors = $context->getMeta( 'validation_errors' );
				if ( is_array( $validationErrors ) && ! empty( $validationErrors ) ) {
					// Rejected answers are never stored (FB-09, FF-13, FA-24).
					$this->discard( $submissionId );
					SpamProtection::release_token( $claimedToken );
					return ApiResponse::validation_error( __( 'Form validation failed', 'subtleforms' ), $validationErrors );
				}
				$this->submissionsRepo->update( $submissionId, array( 'status' => 'failed' ) );
				SpamProtection::release_token( $claimedToken );
				Logger::error( 'Pipeline execution failed for submission %d: %s', $submissionId, $e->getMessage() );

				return ApiResponse::server_error( __( 'Your submission could not be completed. Please try again later.', 'subtleforms' ) );
			} catch ( \Throwable $e ) {
				$this->submissionsRepo->update( $submissionId, array( 'status' => 'failed' ) );
				$voidPayment();
				Logger::error( 'Unexpected error in submission %d: %s', $submissionId, $e->getMessage() );
				return ApiResponse::server_error( __( 'An unexpected error occurred', 'subtleforms' ) );
			}

			if ( ! $result->ok ) {
				$voidPayment();
				$validationErrors = $context->getMeta( 'validation_errors' );
				if ( is_array( $validationErrors ) && ! empty( $validationErrors ) ) {
					// Rejected answers are never stored (FB-09, FF-13, FA-24).
					$this->discard( $submissionId );
					SpamProtection::release_token( $claimedToken );
					return ApiResponse::validation_error( __( 'Form validation failed', 'subtleforms' ), $validationErrors );
				}
				$this->submissionsRepo->update( $submissionId, array( 'status' => 'failed' ) );
				SpamProtection::release_token( $claimedToken );
				Logger::error( 'Pipeline execution failed for submission %d: %s', $submissionId, $result->error );

				return ApiResponse::server_error( $result->error );
			}

		// Finalize submission status
		$finalSubmission = $this->submissionsRepo->find( $submissionId );
		if ( $finalSubmission && $finalSubmission['status'] === 'saved' ) {
			// Record consent timestamps (GDPR audit) into submission meta. Done
			// for both payment and non-payment forms so consent is always stamped.
			$this->recordConsents( $submissionId, $finalSubmission, $payload, $activeSchema['schema'] ?? $activeSchema );

			if ( ! $isPaymentForm ) {
				$this->submissionsRepo->update( $submissionId, array( 'status' => ! empty( $isPreview ) ? 'preview' : 'completed' ) );
				if ( empty( $isPreview ) && ! empty( $order['quote']['coupon'] ) ) {
					// A coupon that made the order free still counts as used.
					$this->finishOrder( $submissionId, $finalSubmission, $order, 'free' );
				}
			} else {
				// The entry is safely stored: the add-on settles the order and
				// reports the outcome through the context (`order_result`:
				// error, status, payment).
				$this->finishOrder( $submissionId, $finalSubmission, $order, 'saved', $context );
				$result = $context->getMeta( 'order_result', array() );
				$result = is_array( $result ) ? $result : array();
				if ( ! empty( $result['error'] ) ) {
					return ApiResponse::error( 'subtleforms_payment_failed', (string) $result['error'], 402 );
				}
				$captured = is_array( $result['payment'] ?? null ) ? $result['payment'] : $paymentMetadata;
				if ( $laterSteps ) {
					// The payment went through: now send the emails and run the
					// integrations that waited for it.
					$captureStatus = (string) ( $captured['status'] ?? '' );
					$context->setMeta( 'entry_status', in_array( $captureStatus, array( 'paid', 'succeeded' ), true ) ? 'completed' : 'payment_pending' );
					$info           = $context->getMeta( 'payment_info', array() );
					$info['status'] = '' !== $captureStatus ? $captureStatus : ( $info['status'] ?? '' );
					$context->setMeta( 'payment_info', $info );
					try {
						$this->pipeline->run( $laterSteps, $context, $activeSchema['schema'] );
					} catch ( \Throwable $e ) {
						Logger::error( 'Actions after payment failed for submission %d: %s', $submissionId, $e->getMessage() );
					}
				}
				$order['payment'] = $captured;
				$status           = in_array( $order['payment']['status'] ?? '', array( 'paid', 'succeeded' ), true ) ? 'completed' : 'payment_pending';
				$this->finishOrder( $submissionId, $finalSubmission, $order, $status );
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

			// A rule in the pipeline (an add-on spam check) stored the entry
			// as spam: it is counted with the blocked spam (2.6.0).
			if ( empty( $isPreview ) && 'spam' === ( $stored['status'] ?? '' ) ) {
				SpamStats::blocked( $formId, 'spam_rule' );
			}

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
			if ( empty( $isPreview ) ) {
				do_action( 'subtleforms/submission/completed', $submissionId, $formId, $payload, $stored, $activeSchema['schema'] ?? $activeSchema );
			}

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
					'confirmation'  => self::resolveConfirmation( $formId, $activeSchema['schema'] ?? $activeSchema, $logicValues ),
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
	// Rate limit (inline, no FeatureGate needed for public endpoint)
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
	 * Price the order for a form that takes payment.
	 *
	 * This plugin prices nothing itself. A payment add-on (SubtleForms Pro)
	 * answers the filter; without one every form is free and no order is made.
	 *
	 * @param int             $formId      Form ID.
	 * @param mixed           $schema      Active schema.
	 * @param array           $payload     Sanitized payload with calculations applied.
	 * @param WP_REST_Request $request     Incoming request.
	 * @param array|null      $logicValues Answers as typed, for conditional logic.
	 * @return array{quote:?array,coupon:?array,payment:?array}|WP_REST_Response
	 */
	private function priceOrder( int $formId, $schema, array $payload, WP_REST_Request $request, ?array $logicValues = null ) {
		$none = array(
			'quote'   => null,
			'coupon'  => null,
			'payment' => null,
		);

		/**
		 * Price this submission's order, check its coupon and confirm payment.
		 *
		 * Return the order array ({ quote, coupon, payment, customer }), or a
		 * WP_REST_Response to refuse the submission. An order with a `payment`
		 * is settled and released through `subtleforms/submit/finish_order`.
		 *
		 * @param array|WP_REST_Response $order       Empty order.
		 * @param int                    $formId      Form ID.
		 * @param mixed                  $schema      Active schema.
		 * @param array                  $payload     Sanitized payload.
		 * @param WP_REST_Request        $request     Incoming request.
		 * @param array|null             $logicValues Answers as typed.
		 * @since 2.8.0
		 */
		$order = apply_filters( 'subtleforms/submit/price_order', $none, $formId, $schema, $payload, $request, $logicValues );

		return ( $order instanceof WP_REST_Response || is_array( $order ) ) ? $order : $none;
	}

	/**
	 * Hand the finished order to the payment add-on, which stores it on the
	 * submission and counts the coupon.
	 *
	 * @param int    $submissionId Submission ID.
	 * @param array  $submission   Stored submission.
	 * @param array  $order        Result of priceOrder().
	 * @param string $status       Final submission status.
	 */
	private function finishOrder( int $submissionId, array $submission, array $order, string $status, ?SubmissionContext $context = null ): void {
		/**
		 * Fires at each step of a priced order after the entry is stored, and
		 * when an order is dropped.
		 *
		 * Status `saved`: the entry is stored and the order has a `payment`
		 * to settle. The add-on settles it and reports back with
		 * `$context->setMeta( 'order_result', array( 'error' => string,
		 * 'status' => string, 'payment' => array ) )`; an error answers the
		 * visitor with HTTP 402. Status `abandoned` (submission ID 0): the
		 * order will not be stored, release what it holds. Any other status is
		 * the final status of the entry (completed, payment_pending, free).
		 *
		 * @param int                    $submissionId Submission ID.
		 * @param array                  $submission   Stored submission.
		 * @param array                  $order        Order from `subtleforms/submit/price_order`.
		 * @param string                 $status       Step or final status.
		 * @param SubmissionContext|null $context      Submission context, for `saved`.
		 * @since 2.8.0
		 */
		do_action( 'subtleforms/submit/finish_order', $submissionId, $submission, $order, $status, $context );
	}

	/**
	 * A value that a computed field (such as a Pro Calculation) could not work
	 * out. It is never stored, shown or charged.
	 */
	const COMPUTE_ERROR = '__formula_error__';

	/**
	 * Let add-ons work out computed fields from the submitted values.
	 *
	 * The server always recomputes these values, so a visitor cannot post a
	 * tampered result. SubtleForms Pro fills its Calculation fields here.
	 *
	 * @param array $payload Sanitized payload.
	 * @param mixed $schema  Active schema.
	 * @return array
	 */
	public static function applyComputedValues( array $payload, $schema ): array {
		if ( ! is_array( $schema ) ) {
			return $payload;
		}

		/**
		 * Filter the submitted values to add computed field values.
		 *
		 * Runs before conditional logic, validation, pricing and storage. A
		 * value that cannot be computed should be PublicSubmitApi::COMPUTE_ERROR.
		 *
		 * @since 2.3.9
		 *
		 * @param array $payload Submitted values.
		 * @param array $schema  Form schema.
		 */
		$computed = apply_filters( 'subtleforms/submission/computed_values', $payload, $schema );

		return is_array( $computed ) ? $computed : $payload;
	}

	/**
	 * Remove an entry the pipeline rejected, with its activity log.
	 *
	 * The record exists only so the pipeline can run; answers the server
	 * refuses never stay in Entries, exports or the entry limit count.
	 *
	 * @param int $submissionId Entry ID.
	 */
	private function discard( int $submissionId ): void {
		// Uploaded files stay pending, so the visitor can fix the answer and
		// send again; unclaimed files are removed after a day.
		$this->submissionsRepo->delete( $submissionId, false );
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
			if ( self::COMPUTE_ERROR === $value ) {
				$payload[ $key ] = null;
			}
		}
		// The spam honeypot and time token are not answers (FLD2-17).
		unset( $payload[ \SubtleForms\Engine\SpamProtection::TIME_FIELD ], $payload[ \SubtleForms\Engine\SpamProtection::HONEYPOT_FIELD ] );
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

		/**
	 * A builder preview is accepted only for an administrator.
	 *
	 * @param array $input Validated body.
	 * @param bool  $canManage Whether the caller can manage options.
	 * @return string live, preview, or forbidden.
	 */
	public static function previewDecision( array $input, bool $canManage ): string {
		if ( empty( $input['preview'] ) ) {
			return 'live';
		}
		return $canManage ? 'preview' : 'forbidden';
	}

	/**
	 * Notification steps are not run for a preview submission.
	 *
	 * @param array $stepIds Action ids.
	 * @param bool  $preview Preview submit.
	 * @return array
	 */
	public static function stepsToRun( array $stepIds, bool $preview ): array {
		if ( ! $preview ) {
			return $stepIds;
		}
		return array_values(
			array_filter(
				$stepIds,
				static function ( $id ) {
					return 'save' === $id;
				}
			)
		);
	}

	private function countSubmissionsBy( int $formId, string $predicate, $value ): int {
		global $wpdb;

		$table_name = $wpdb->prefix . 'subtleforms_submissions';

		// phpcs:disable PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare, WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Table name is from $wpdb->prefix. $predicate is one of two fixed internal strings, each carrying exactly one placeholder, so the sniff's count is short by one; both values are bound by prepare().
		return (int) $wpdb->get_var(
			$wpdb->prepare(
				"SELECT COUNT(*) FROM {$table_name} WHERE form_id = %d AND {$predicate} AND status != 'spam' AND status != 'trash' AND status != 'preview'",
				$formId,
				$value
			)
		);
		// phpcs:enable PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare, WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
	}

	private function guardRateLimit( WP_REST_Request $request ): ?WP_REST_Response {
		$userId = get_current_user_id() ?: null;
		$ip     = \SubtleForms\Security\ClientIp::get();
		$ip     = '' !== $ip ? $ip : '0.0.0.0';
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

                // Check if a pipeline-level webhook action already exists, no double-fire.
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
