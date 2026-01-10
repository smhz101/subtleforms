<?php
declare(strict_types=1);

namespace SubtleForms\Engine;

use SubtleForms\Support\FeatureGate;
use SubtleForms\Repositories\LogsRepository;
use SubtleForms\Engine\PipelineEvent;
use Throwable;

/**
 * Executes steps in order with capability enforcement.
 *
 * This is the authoritative layer: UI/REST/CLI all feed into this.
 */
final class Pipeline {

	/**
	 * @var FeatureGate
	 */
	private $gate;

	/**
	 * @var LogsRepository
	 */
	private $logs;

	/**
	 * @var SchemaCompiler|null
	 */
	private $compiler;

	/**
	 * @param FeatureGate      $gate
	 * @param LogsRepository   $logs
	 * @param SchemaCompiler|null $compiler
	 */
	public function __construct( $gate, $logs, $compiler = null ) {
		$this->gate     = $gate;
		$this->logs     = $logs;
		$this->compiler = $compiler;
	}

	/**
	 * @param PipelineStepInterface[] $steps
	 */
	public function run( array $steps, SubmissionContext $ctx, ?array $schema = null ): PipelineResult {
		$events = array();

		try {
			// Evaluate conditional logic before executing steps
			if ( $schema && $this->compiler ) {
				$this->compiler->evaluateConditions( $schema, $ctx );
			}

			foreach ( $steps as $step ) {
				$ts = time();

				// Log start
				$this->logEvent( $ctx, $step, 'started', null, $ts );

				foreach ( $step->requires() as $cap ) {
					if ( $this->gate->allows( $cap ) ) {
						continue;
					}

					if ( $step->skippable() ) {
						$this->logEvent( $ctx, $step, 'skipped', 'capability_denied', $ts );
						continue 2; // skip this step entirely
					}

					$this->gate->require( $cap, sprintf( 'Step "%s" requires capability "%s".', $step->id(), $cap ) );
				}

				// Expose current step id/settings in context for action implementations
				$ctx->setMeta( 'current_step_id', $step->id() );
				$ctx->setMeta( 'current_step_settings', $step->settings() );

				try {
					$step->action()->handle( $ctx );
				} catch ( Throwable $e ) {
					// Hard failure: log and rethrow to be handled by outer catch
					$this->logEvent( $ctx, $step, 'failed', $e->getMessage(), time() );
					throw $e;
				}

				// Check for soft failures recorded by action implementations
				$fails = $ctx->getMeta( 'action_failures', array() );
				$found = false;
				if ( is_array( $fails ) ) {
					$remaining = array();
					foreach ( $fails as $f ) {
						if ( isset( $f['action'] ) && $f['action'] === $step->action()->id() ) {
							$found  = true;
							$reason = $f['reason'] ?? 'failure';
							$this->logEvent( $ctx, $step, 'failed', (string) ( $f['response'] ?? $reason ), time() );
							// don't add to remaining
						} else {
							$remaining[] = $f;
						}
					}

					// update remaining failures back into context to avoid duplicate logging
					$ctx->setMeta( 'action_failures', $remaining );
				}

				if ( ! $found ) {
					$this->logEvent( $ctx, $step, 'succeeded', null, time() );
				}

				// Clear step-specific transient meta
				$ctx->setMeta( 'current_step_id', null );
				$ctx->setMeta( 'current_step_settings', null );
			}

			return new PipelineResult( true, $events, null );
		} catch ( Throwable $e ) {
			$events[] = array(
				'type'    => 'pipeline.error',
				'message' => $e->getMessage(),
				'ts'      => time(),
			);

			return new PipelineResult( false, $events, $e->getMessage() );
		}
	}

	private function logEvent( SubmissionContext $ctx, PipelineStepInterface $step, string $status, ?string $error, int $ts ): void {
		$submissionId = $ctx->getMeta( 'submission_id' );
		if ( empty( $submissionId ) || ! is_int( $submissionId ) ) {
			return; // nothing to persist
		}

		$schemaVersion = $ctx->getMeta( 'schema_version' );

		$evt = new PipelineEvent(
			$submissionId,
			is_int( $schemaVersion ) ? $schemaVersion : null,
			$step->id(),
			$step->action()->id(),
			$status,
			$error,
			$ts
		);

		$level = $status === 'succeeded' || $status === 'started' || $status === 'skipped' ? 'info' : 'error';

		$this->logs->create(
			array(
				'submission_id' => $submissionId,
				'level'         => $level,
				'message'       => sprintf( 'Step %s: %s', $step->id(), $status ),
				'context'       => $evt->toArray(),
			)
		);
	}
}
