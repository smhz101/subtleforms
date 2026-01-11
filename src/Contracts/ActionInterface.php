<?php
/**
 * SubtleForms Action Interface
 *
 * @package   SubtleForms\Contracts
 * @version   0.1.0
 */

namespace SubtleForms\Contracts;

use SubtleForms\Engine\SubmissionContext;

/**
 * Actions are the actual work units (send email, save to DB, call webhook, etc.).
 */
interface ActionInterface {

	/**
	 * Unique identifier for this action type.
	 */
	public function id(): string;

	/**
	 * Execute the action with the given context.
	 */
	public function handle( SubmissionContext $context ): void;

	/**
	 * Human-readable label for the action.
	 */
	public function label(): string;

	/**
	 * Optional: Validate the action configuration.
	 */
	public function validate(): bool;
}
