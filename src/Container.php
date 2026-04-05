<?php
/**
 * SubtleForms Container
 *
 * @package   SubtleForms
 * @version   0.1.0
 */

namespace SubtleForms;

use SubtleForms\Support\Capabilities;
use SubtleForms\Support\FeatureGate;
use SubtleForms\Support\Logger;
use SubtleForms\Support\Settings;
use SubtleForms\Support\Captcha\CaptchaManager;
use SubtleForms\Engine\Pipeline;
use SubtleForms\Engine\ActionRegistry;
use SubtleForms\Engine\SchemaCompiler;
use SubtleForms\Engine\ActionDefinition;
use SubtleForms\Extensions\ExtensionManager;
use SubtleForms\Extensions\WebhooksExtension;
use SubtleForms\Extensions\EmailMarketingExtension;
use SubtleForms\Extensions\CrmExtension;
use SubtleForms\Extensions\AnalyticsExtension;
use SubtleForms\Extensions\EcommerceExtension;
use SubtleForms\Extensions\PdfExtension;
use SubtleForms\Extensions\MultilanguageExtension;
use SubtleForms\Extensions\PaymentsExtension;
use SubtleForms\Admin\AdminMenu;
use SubtleForms\Api\RestController;
use SubtleForms\Repositories\SubmissionsRepository;
use SubtleForms\Repositories\FormsRepository;
use SubtleForms\Repositories\LogsRepository;
use SubtleForms\Fields\FieldRegistry;
use SubtleForms\Fields\CoreFields;
use SubtleForms\Security\RateLimiter;

/**
 * Simple dependency injection container.
 *
 * @since 0.1.0
 * @since 1.9.0 Added set(), reset(), forgetInstance() for testability (Phase 1.3).
 */
final class Container {

	private array $services   = array();
	private array $singletons = array();
	private array $instances  = array();

	/**
	 * Register a service factory.
	 */
	public function register( string $id, callable $factory ): void {
		$this->services[ $id ] = $factory;
	}

	/**
	 * Register a singleton service.
	 */
	public function singleton( string $id, callable $factory ): void {
		$this->register( $id, $factory );
		$this->singletons[ $id ] = true;
	}

	/**
	 * Directly inject a pre-built instance into the container.
	 *
	 * This bypasses the factory and caches the instance as a singleton.
	 * Primarily intended for test doubles (mocks, stubs), but also useful
	 * for extensions that construct their own service instances.
	 *
	 * @param string $id       Service identifier (usually FQCN).
	 * @param mixed  $instance The pre-built instance to inject.
	 */
	public function set( string $id, $instance ): void {
		// Register a no-op factory so has() returns true.
		$this->services[ $id ]   = static fn() => $instance;
		$this->singletons[ $id ] = true;
		$this->instances[ $id ]  = $instance;
	}

	/**
	 * Get a service from the container.
	 */
	public function get( string $id ) {
		if ( ! isset( $this->services[ $id ] ) ) {
			throw new \RuntimeException( "Service '{$id}' not found in container." );
		}

		// If it's a singleton and already instantiated, return the cached instance
		if ( isset( $this->singletons[ $id ] ) && isset( $this->instances[ $id ] ) ) {
			return $this->instances[ $id ];
		}

		$service = $this->services[ $id ]( $this );

		// Cache singleton instances
		if ( isset( $this->singletons[ $id ] ) ) {
			$this->instances[ $id ] = $service;
		}

		return $service;
	}

	/**
	 * Check if a service exists.
	 */
	public function has( string $id ): bool {
		return isset( $this->services[ $id ] );
	}

	/**
	 * Forget a cached singleton instance so the next get() re-resolves it.
	 *
	 * @param string $id Service identifier.
	 */
	public function forgetInstance( string $id ): void {
		unset( $this->instances[ $id ] );
	}

	/**
	 * Reset the entire container — clears all services, singletons, and instances.
	 *
	 * Intended for test teardown to avoid state leaking between tests.
	 */
	public function reset(): void {
		$this->services   = array();
		$this->singletons = array();
		$this->instances  = array();
	}

	/**
	 * Bootstrap default services.
	 */
	public function bootstrap(): void {
		// Support services
		$this->singleton(
			Capabilities::class,
			fn() => new Capabilities()
		);
		$this->singleton( FeatureGate::class, fn( $c ) => new FeatureGate( $c->get( Capabilities::class ) ) );
		$this->singleton( Logger::class, fn() => new Logger() );
		$this->singleton( Settings::class, fn() => new Settings() );
		$this->singleton( CaptchaManager::class, fn( $c ) => new CaptchaManager( $c->get( Settings::class ) ) );

		// Security services
		$this->singleton( RateLimiter::class, fn() => new RateLimiter() );

		// Repositories
		$this->singleton( FormsRepository::class, fn() => new FormsRepository() );
		$this->singleton( SubmissionsRepository::class, fn() => new SubmissionsRepository() );
		$this->singleton( LogsRepository::class, fn() => new LogsRepository() );

		// Field Registry
		$this->singleton(
			FieldRegistry::class,
			function () {
				$registry = new FieldRegistry();
				CoreFields::register( $registry );

				// Allow extensions to register custom fields
				if ( function_exists( 'do_action' ) ) {
					do_action( 'subtleforms/fields/register', $registry );
				}

				return $registry;
			}
		);

		// Engine
		$this->singleton(
			ActionRegistry::class,
			function () {
				$reg = new ActionRegistry();

				// Register core action definitions (metadata only). Implementations
				// may be registered later by core or extensions.
				$reg->registerDefinition( new ActionDefinition( 'save', 'Save submission', 'Persist submission to storage', array( 'actions.save' ) ) );
				$reg->registerDefinition( new ActionDefinition( 'email', 'Send email', 'Send notification email', array( 'actions.email' ) ) );
				$reg->registerDefinition( new ActionDefinition( 'webhook', 'Call webhook', 'Send payload to external HTTP endpoint', array( 'actions.webhook' ) ) );

				/** Allow extensions to register additional definitions/implementations via action hook */
				if ( function_exists( 'do_action' ) ) {
					do_action( 'subtleforms/register_actions', $reg );
				}

				return $reg;
			}
		);
		$this->singleton(
			Pipeline::class,
			fn( $c ) => new Pipeline(
				$c->get( FeatureGate::class ),
				$c->get( LogsRepository::class ),
				$c->get( SchemaCompiler::class )
			)
		);

		// Extensions
		$this->singleton( ExtensionManager::class, fn( $c ) => new ExtensionManager( $c->get( FeatureGate::class ) ) );

		// Register built-in extensions.  Each is added to the manager here so
		// that Plugin::init() can call manager->boot() on the 'init' hook after
		// capability filters (e.g. from the Pro plugin) have already run.
		$this->singleton(
			WebhooksExtension::class,
			fn( $c ) => new WebhooksExtension( $c->get( Settings::class ), $c->get( FeatureGate::class ) )
		);
		$this->singleton(
			EmailMarketingExtension::class,
			fn( $c ) => new EmailMarketingExtension( $c->get( Settings::class ), $c->get( FeatureGate::class ) )
		);
		$this->singleton(
			CrmExtension::class,
			fn( $c ) => new CrmExtension( $c->get( Settings::class ), $c->get( FeatureGate::class ) )
		);
		$this->singleton(
			AnalyticsExtension::class,
			fn( $c ) => new AnalyticsExtension( $c->get( Settings::class ), $c->get( FeatureGate::class ) )
		);
		$this->singleton(
			EcommerceExtension::class,
			fn( $c ) => new EcommerceExtension( $c->get( Settings::class ), $c->get( FeatureGate::class ) )
		);
		$this->singleton(
			PdfExtension::class,
			fn( $c ) => new PdfExtension( $c->get( Settings::class ), $c->get( FeatureGate::class ) )
		);
		$this->singleton(
			MultilanguageExtension::class,
			fn( $c ) => new MultilanguageExtension( $c->get( Settings::class ), $c->get( FeatureGate::class ) )
		);
		$this->singleton(
			PaymentsExtension::class,
			fn( $c ) => new PaymentsExtension( $c->get( Settings::class ), $c->get( FeatureGate::class ) )
		);

		// Register extensions via an action hook so the Pro plugin (or any add-on)
		// can hook in at priority 10 (default) and add its own implementations.
		// Built-in stubs are added at priority 20 as a fallback.
		add_action(
			'subtleforms/register_extensions',
			function ( ExtensionManager $mgr ) {
				$mgr->add( $this->get( WebhooksExtension::class ) );
				$mgr->add( $this->get( EmailMarketingExtension::class ) );
				$mgr->add( $this->get( CrmExtension::class ) );
				$mgr->add( $this->get( AnalyticsExtension::class ) );
				$mgr->add( $this->get( EcommerceExtension::class ) );
				$mgr->add( $this->get( PdfExtension::class ) );
				$mgr->add( $this->get( MultilanguageExtension::class ) );
				$mgr->add( $this->get( PaymentsExtension::class ) );
			},
			20 // later priority, so Pro plugin at default (10) can register first
		);

		// Fire the subtleforms/register_extensions hook inside plugins_loaded so the
		// manager is fully populated before Plugin::init() calls boot() on 'init'.
		add_action(
			'plugins_loaded',
			function () {
				$mgr = $this->get( ExtensionManager::class );
				/**
				 * Fires when extensions should be registered into ExtensionManager.
				 *
				 * Pro plugin or third-party add-ons hook into this action at priority 10
				 * to register their extension instances. Built-in stubs run at priority 20.
				 *
				 * @since 2.1.0
				 * @param ExtensionManager $mgr The extension manager instance.
				 */
				do_action( 'subtleforms/register_extensions', $mgr );
			},
			5 // priority 5 = before Plugin::init() runs at default plugins_loaded priority
		);

		// Compiler with conditional logic
		$this->singleton( \SubtleForms\Engine\ConditionalLogic::class, fn( $c ) => new \SubtleForms\Engine\ConditionalLogic() );
		$this->singleton(
			SchemaCompiler::class,
			fn( $c ) => new SchemaCompiler(
				$c->get( ActionRegistry::class ),
				$c->get( \SubtleForms\Engine\ConditionalLogic::class )
			)
		);

		// Admin & API
		$this->singleton(
			AdminMenu::class,
			fn( $c ) => new AdminMenu(
				$c->get( Capabilities::class ),
				$c->get( FormsRepository::class ),
				$c->get( SubmissionsRepository::class )
			)
		);
		$this->singleton(
			RestController::class,
			fn( $c ) => new RestController(
				$c->get( Pipeline::class ),
				$c->get( FormsRepository::class ),
				$c->get( SubmissionsRepository::class ),
				$c->get( FeatureGate::class ),
				$c->get( FieldRegistry::class ),
				$c->get( SchemaCompiler::class ),
				$c->get( Settings::class ),
				$c->get( CaptchaManager::class )
			)
		);
		// Frontend
		$this->singleton(
			\SubtleForms\Frontend\Shortcode::class,
			fn( $c ) => new \SubtleForms\Frontend\Shortcode(
				$c->get( FormsRepository::class ),
				$c->get( Settings::class ),
				$c->get( CaptchaManager::class )
			)
		);

		// Privacy & GDPR
		$this->singleton(
			\SubtleForms\Privacy\PrivacyExporter::class,
			fn( $c ) => new \SubtleForms\Privacy\PrivacyExporter(
				$c->get( SubmissionsRepository::class ),
				$c->get( FormsRepository::class )
			)
		);
		$this->singleton(
			\SubtleForms\Privacy\PrivacyEraser::class,
			fn( $c ) => new \SubtleForms\Privacy\PrivacyEraser(
				$c->get( SubmissionsRepository::class )
			)
		);
		$this->singleton(
			\SubtleForms\Privacy\PrivacyManager::class,
			fn( $c ) => new \SubtleForms\Privacy\PrivacyManager(
				$c->get( Settings::class ),
				$c->get( SubmissionsRepository::class )
			)
		);

		// Register core action implementations now that definitions exist.
		// Implementations must be registered after the ActionRegistry (and its definitions) are created.
		$reg = $this->get( ActionRegistry::class );
		// Save action depends on SubmissionsRepository
		$reg->register( new \SubtleForms\Engine\Actions\SaveAction( $this->get( SubmissionsRepository::class ) ) );
		$reg->register( new \SubtleForms\Engine\Actions\EmailAction() );
		$reg->register( new \SubtleForms\Engine\Actions\WebhookAction() );
	}
}
