<?php
declare(strict_types=1);

namespace SubtleForms\Engine;

/**
 * Pipeline execution result.
 */
final class PipelineResult {

	/**
	 * @var bool
	 */
	public $ok;

	/**
	 * @var array<int,array<string,mixed>>
	 */
	public $events;

	/**
	 * @var string|null
	 */
	public $error;

	/**
	 * @param bool                           $ok
	 * @param array<int,array<string,mixed>> $events
	 * @param string|null                    $error
	 */
	public function __construct(
		$ok,
		$events = array(),
		$error = null
	) {
		$this->ok     = $ok;
		$this->events = $events;
		$this->error  = $error;
	}

	/**
	 * Serialize result to array for API responses.
	 *
	 * @return array<string,mixed>
	 */
	public function toArray(): array {
		return array(
			'ok'     => $this->ok,
			'events' => $this->events,
			'error'  => $this->error,
		);
	}
}
