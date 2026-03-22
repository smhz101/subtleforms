<?php
/**
 * SubtleForms REST API Router
 *
 * Thin routing layer that delegates to domain-specific API controllers.
 * All handler logic lives in the individual Api classes; this class
 * only wires routes and instantiates the sub-controllers.
 *
 * @package   SubtleForms\Api
 * @since     0.1.0
 * @since     1.9.0 Refactored from monolith to thin router (Phase 1.1).
 */

namespace SubtleForms\Api;

use SubtleForms\Support\Logger;
use SubtleForms\Engine\Pipeline;
use SubtleForms\Repositories\FormsRepository;
use SubtleForms\Repositories\SubmissionsRepository;
use SubtleForms\Support\FeatureGate;
use SubtleForms\Support\Settings;
use SubtleForms\Support\Captcha\CaptchaManager;
use SubtleForms\Engine\SchemaCompiler;
use SubtleForms\Fields\FieldRegistry;
use SubtleForms\Licensing\SubscriptionManager;

/**
 * REST API router for SubtleForms.
 *
 * Instantiates domain API controllers and registers their routes.
 * No request handling happens here — each controller owns its endpoints.
 */
final class RestController {

	/** @var Pipeline */
	private $pipeline;

	/** @var FormsRepository */
	private $formsRepo;

	/** @var SubmissionsRepository */
	private $submissionsRepo;

	/** @var FeatureGate */
	private $gate;

	/** @var FieldRegistry */
	private $fieldRegistry;

	/** @var SchemaCompiler */
	private $compiler;

	/** @var Settings|null */
	private $settings;

	/** @var CaptchaManager|null */
	private $captchaManager;

	/** @var SubscriptionManager|null */
	private $subscriptionManager;

	/**
	 * Constructor — same signature as pre-1.9.0 for backward compatibility.
	 *
	 * @param Pipeline              $pipeline        Submission pipeline.
	 * @param FormsRepository       $formsRepo       Forms repository.
	 * @param SubmissionsRepository $submissionsRepo Submissions repository.
	 * @param FeatureGate           $gate            Feature gate.
	 * @param FieldRegistry         $fieldRegistry   Field registry.
	 * @param SchemaCompiler        $compiler        Schema compiler.
	 * @param Settings|null         $settings        Plugin settings.
	 * @param CaptchaManager|null   $captchaManager  CAPTCHA manager.
	 * @param SubscriptionManager|null $subscriptionManager Subscription manager.
	 */
	public function __construct(
		$pipeline,
		$formsRepo,
		$submissionsRepo,
		$gate,
		$fieldRegistry,
		$compiler,
		$settings = null,
		$captchaManager = null,
		$subscriptionManager = null
	) {
		$this->pipeline            = $pipeline;
		$this->formsRepo           = $formsRepo;
		$this->submissionsRepo     = $submissionsRepo;
		$this->gate                = $gate;
		$this->fieldRegistry       = $fieldRegistry;
		$this->compiler            = $compiler;
		$this->settings            = $settings;
		$this->captchaManager      = $captchaManager;
		$this->subscriptionManager = $subscriptionManager;

		Logger::debug( 'RestController (router) initialized' );
	}

	/**
	 * Register all REST API routes by delegating to domain controllers.
	 *
	 * Each controller owns its own route definitions, permission callbacks,
	 * and request handling. This method simply instantiates and delegates.
	 */
	public function register_routes(): void {
		// ── Domain API controllers (Phase 1.1) ─────────────────────────
		$formsApi = new FormsApi(
			$this->formsRepo,
			$this->submissionsRepo,
			$this->gate,
			$this->settings,
			$this->captchaManager
		);
		$formsApi->registerRoutes();

		$submissionsApi = new SubmissionsApi(
			$this->formsRepo,
			$this->submissionsRepo,
			$this->gate
		);
		$submissionsApi->registerRoutes();

		$publicSubmitApi = new PublicSubmitApi(
			$this->pipeline,
			$this->formsRepo,
			$this->submissionsRepo,
			$this->compiler,
			$this->captchaManager
		);
		$publicSubmitApi->registerRoutes();

		$fieldsApi = new FieldsApi(
			$this->fieldRegistry,
			$this->gate,
			$this->settings
		);
		$fieldsApi->registerRoutes();

		// ── Already-extracted controllers ──────────────────────────────
		if ( $this->settings ) {
			$settingsApi = new SettingsApi( $this->settings );
			$settingsApi->registerRoutes();
		}

		$dashboardApi = new DashboardApi(
			$this->formsRepo,
			$this->submissionsRepo,
			$this->settings
		);
		$dashboardApi->registerRoutes();

		$onboardingApi = new OnboardingApi();
		$onboardingApi->registerRoutes();

		if ( $this->subscriptionManager ) {
			$licenseApi = new LicenseApi( $this->subscriptionManager );
			$licenseApi->registerRoutes();
		}
	}
}
