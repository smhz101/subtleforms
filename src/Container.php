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
use SubtleForms\Admin\AdminMenu;
use SubtleForms\Api\RestController;
use SubtleForms\Api\LicenseApi;
use SubtleForms\Repositories\SubmissionsRepository;
use SubtleForms\Repositories\FormsRepository;
use SubtleForms\Repositories\LogsRepository;
use SubtleForms\Fields\FieldRegistry;
use SubtleForms\Fields\CoreFields;
use SubtleForms\Licensing\LicenseManager;
use SubtleForms\Licensing\LicenseValidator;
use SubtleForms\Licensing\LicenseScheduler;
use SubtleForms\Security\RateLimiter;

/**
 * Simple dependency injection container.
 */
final class Container {

	private array $services   = array();
	private array $singletons = array();

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

	private array $instances = array();

	/**
	 * Check if a service exists.
	 */
	public function has( string $id ): bool {
		return isset( $this->services[ $id ] );
	}

	/**
	 * Bootstrap default services.
	 */
	public function bootstrap(): void {
		// Support services
		$this->singleton( Capabilities::class, fn() => new Capabilities() );
		$this->singleton( FeatureGate::class, fn( $c ) => new FeatureGate( $c->get( Capabilities::class ) ) );
		$this->singleton( Logger::class, fn() => new Logger() );
		$this->singleton( Settings::class, fn() => new Settings() );
		$this->singleton( CaptchaManager::class, fn( $c ) => new CaptchaManager( $c->get( Settings::class ) ) );

		// Security services
		$this->singleton( RateLimiter::class, fn() => new RateLimiter() );

		// Licensing services
		$this->singleton( LicenseValidator::class, fn() => new LicenseValidator() );
		$this->singleton(
			LicenseManager::class,
			fn( $c ) => new LicenseManager(
				$c->get( Settings::class ),
				$c->get( LicenseValidator::class )
			)
		);
		$this->singleton(
			LicenseScheduler::class,
			fn( $c ) => new LicenseScheduler(
				$c->get( LicenseManager::class )
			)
		);

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
					do_action( 'subtleforms.register_actions', $reg );
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
		$this->singleton(
			LicenseApi::class,
			fn( $c ) => new LicenseApi(
				$c->get( LicenseManager::class ),
				$c->get( RateLimiter::class )
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
