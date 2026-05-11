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
			$limit    = isset( $settings['submission_limit'] ) ? (int) $settings['submission_limit'] : 1;
			$user_key = get_current_user_id();

			if ( ! $user_key && $ip ) {
				$user_key = 'ip_' . md5( $ip );
			}

			if ( $user_key ) {
				global $wpdb;
				$table_name = $wpdb->prefix . 'subtleforms_submissions';
				// phpcs:disable PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Table name is $wpdb->prefix controlled.
				$count      = $wpdb->get_var(
					$wpdb->prepare(
						"SELECT COUNT(*) FROM {$table_name} WHERE form_id = %d AND (user_id = %d OR ip_address = %s) AND status != 'spam'",
						$formId,
						is_numeric( $user_key ) ? $user_key : 0,
						$ip ? $ip : ''
					)
				);
				// phpcs:enable PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching

				if ( $count >= $limit ) {
					return ApiResponse::forbidden(
						__( 'You have reached the maximum number of submissions for this form.', 'subtleforms' )
					);
				}
			}
		}

		// Resolve active schema version
		try {
			$activeSchema = $this->formsRepo->loadSchemaVersion( $formId );
		} catch ( \RuntimeException $e ) {
			Logger::error( 'Submission Error: %s', $e->getMessage() );
			return ApiResponse::server_error( __( 'Failed to load form schema: ', 'subtleforms' ) . $e->getMessage() );
		}
		$formVersion = $activeSchema['version'] ?? null;

		// Create submission record
		try {
			$submissionId = $this->submissionsRepo->create(
				array(
					'form_id'        => $formId,
					'schema_version' => $formVersion,
					'payload'        => $payload,
					'status'         => 'processing',
					'ip_address'     => $ip ?: null,
					'user_agent'     => isset( $_SERVER['HTTP_USER_AGENT'] ) ? sanitize_text_field( wp_unslash( $_SERVER['HTTP_USER_AGENT'] ) ) : null,
				)
			);
		} catch ( \RuntimeException $e ) {
			Logger::error( 'Failed to create submission record: %s', $e->getMessage() );
			return ApiResponse::server_error( __( 'Failed to create submission record', 'subtleforms' ) );
		}

		// Build submission context
		$context = new SubmissionContext( $formId, $payload );
		$context->setMeta( 'submission_id', $submissionId );
		$context->setMeta( 'schema_version', is_int( $formVersion ) ? $formVersion : null );

		// Detect payment form
		$isPaymentForm   = false;
		$paymentMetadata = null;
		if ( ! empty( $activeSchema['schema']['metadata']['type'] ) &&
			$activeSchema['schema']['metadata']['type'] === 'payment' ) {
			$isPaymentForm = true;

			$paymentSettings = $activeSchema['schema']['metadata']['payment'] ?? array();

			$amount = 0;
			if ( ! empty( $paymentSettings['enabled'] ) ) {
				if ( ( $paymentSettings['amountType'] ?? 'fixed' ) === 'fixed' ) {
					$amount = floatval( $paymentSettings['fixedAmount'] ?? 0 );
				} elseif ( ( $paymentSettings['amountType'] ?? '' ) === 'field' ) {
					$amountField = $paymentSettings['amountField'] ?? '';
					if ( ! empty( $amountField ) && isset( $payload[ $amountField ] ) ) {
						$amount = floatval( $payload[ $amountField ] );
					}
				}
			}

			$paymentMetadata = array(
				'status'         => 'pending',
				'amount'         => $amount,
				'currency'       => $paymentSettings['currency'] ?? 'USD',
				'mode'           => $paymentSettings['mode'] ?? 'test',
				'gateway'        => null,
				'transaction_id' => null,
				'created_at'     => current_time( 'mysql' ),
			);

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
				Logger::error( 'Schema compilation failed for form %d: %s', $formId, $e->getMessage() );
				return ApiResponse::bad_request( $e->getMessage() );
			}

			try {
				$result = $this->pipeline->run( $steps, $context, $activeSchema['schema'] );
			} catch ( \RuntimeException $e ) {
				$this->submissionsRepo->update( $submissionId, array( 'status' => 'failed' ) );
				Logger::error( 'Pipeline execution failed for submission %d: %s', $submissionId, $e->getMessage() );

				$validationErrors = $context->getMeta( 'validation_errors' );
				if ( is_array( $validationErrors ) && ! empty( $validationErrors ) ) {
					return ApiResponse::validation_error( __( 'Form validation failed', 'subtleforms' ), $validationErrors );
				}

				return ApiResponse::server_error( $e->getMessage() );
			} catch ( \Throwable $e ) {
				$this->submissionsRepo->update( $submissionId, array( 'status' => 'failed' ) );
				Logger::error( 'Unexpected error in submission %d: %s', $submissionId, $e->getMessage() );
				return ApiResponse::server_error( __( 'An unexpected error occurred', 'subtleforms' ) );
			}

			if ( ! $result->ok ) {
				$this->submissionsRepo->update( $submissionId, array( 'status' => 'failed' ) );
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
				if ( ! $isPaymentForm ) {
					$this->submissionsRepo->update( $submissionId, array( 'status' => 'completed' ) );
				} else {
					if ( $paymentMetadata ) {
						$currentMeta = $finalSubmission['meta'] ?? array();
						if ( ! is_array( $currentMeta ) ) {
							$currentMeta = array();
						}
						$currentMeta['payment'] = $paymentMetadata;

						$this->submissionsRepo->update(
							$submissionId,
							array(
								'status' => 'payment_pending',
								'meta'   => $currentMeta,
							)
						);
					}

					/**
					 * Hook: subtleforms_payment_required
					 *
					 * @param int               $submissionId    The submission ID.
					 * @param array             $paymentMetadata Payment intent data.
					 * @param SubmissionContext  $context         Full submission context.
					 * @since 1.2.0
					 */
					do_action( 'subtleforms/payment/required', $submissionId, $paymentMetadata, $context );
				}
			} elseif ( ! $finalSubmission || $finalSubmission['status'] === 'processing' ) {
				Logger::error( 'Submission %d did not reach saved status', $submissionId );
				$this->submissionsRepo->update( $submissionId, array( 'status' => 'failed' ) );
				return ApiResponse::server_error( __( 'Failed to save submission data', 'subtleforms' ) );
			}

			return ApiResponse::success(
				array(
					'success'       => true,
					'submission_id' => $submissionId,
				)
			);
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

	// ────────────────────────────────────────────────────────────────────
	// Rate limit (inline — no FeatureGate needed for public endpoint)
	// ────────────────────────────────────────────────────────────────────

	/**
	 * Guard rate limit for request.
	 */
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
