<?php
declare(strict_types=1);

namespace SubtleForms\Engine;

/**
 * Runtime context for a single submission execution.
 * Keep it immutable-ish: store input + derived state + execution metadata.
 */
final class SubmissionContext {

	/**
	 * @var int
	 */
	public $formId;

	/**
	 * @var array<string,mixed>
	 */
	public $payload;

	/**
	 * @var array<string,mixed>
	 */
	public $meta;

	/**
	 * @param int                 $formId
	 * @param array<string,mixed> $payload
	 * @param array<string,mixed> $meta
	 */
	public function __construct(
		$formId,
		$payload,
		$meta = array()
	) {
		$this->formId  = $formId;
		$this->payload = $payload;
		$this->meta    = $meta;
	}

	/**
	 * @param string $key
	 * @param mixed  $value
	 */
	public function setMeta( $key, $value ) {
		$this->meta[ $key ] = $value;
	}

	/**
	 * @param string $key
	 * @param mixed  $default
	 * @return mixed
	 */
	public function getMeta( $key, mixed $default = null ) {
		return isset( $this->meta[ $key ] ) ? $this->meta[ $key ] : $default;
	}
}
