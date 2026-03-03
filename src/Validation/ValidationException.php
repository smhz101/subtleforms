<?php
/**
 * ValidationException
 *
 * Custom exception for validation failures with field-level error details.
 * Designed to be caught and converted to ApiResponse::validation_error().
 *
 * @package SubtleForms\Validation
 * @since 1.9.0 (Phase A2-P1)
 */

namespace SubtleForms\Validation;

use Exception;

/**
 * ValidationException class
 *
 * Thrown when request validation fails. Contains field-level error details
 * for precise error reporting to the frontend.
 */
class ValidationException extends Exception {

	/**
	 * Error code for API response
	 *
	 * @var string
	 */
	public $errorCode = 'validation_failed';

	/**
	 * Field-level errors
	 *
	 * @var array<string,string> Key-value pairs of field paths to error messages
	 */
	public $fields = array();

	/**
	 * Additional metadata
	 *
	 * @var array
	 */
	public $meta = array();

	/**
	 * HTTP status code
	 *
	 * @var int
	 */
	public $status = 422;

	/**
	 * Constructor
	 *
	 * @param string $message Main validation error message
	 * @param array  $fields Field-level errors (field => message)
	 * @param string $code Error code (default: validation_failed)
	 * @param array  $meta Additional metadata
	 * @param int    $status HTTP status code (default: 422)
	 */
	public function __construct(
		string $message = 'Validation failed',
		array $fields = array(),
		string $code = 'validation_failed',
		array $meta = array(),
		int $status = 422
	) {
		parent::__construct( $message );

		$this->errorCode = $code;
		$this->fields    = $fields;
		$this->meta      = $meta;
		$this->status    = $status;
	}

	/**
	 * Get error code
	 *
	 * @return string
	 */
	public function getErrorCode(): string {
		return $this->errorCode;
	}

	/**
	 * Get field-level errors
	 *
	 * @return array<string,string>
	 */
	public function getFields(): array {
		return $this->fields;
	}

	/**
	 * Get additional metadata
	 *
	 * @return array
	 */
	public function getMeta(): array {
		return $this->meta;
	}

	/**
	 * Get HTTP status code
	 *
	 * @return int
	 */
	public function getStatus(): int {
		return $this->status;
	}

	/**
	 * Convert to array for API response
	 *
	 * @return array{code: string, message: string, fields: array, meta: array, status: int}
	 */
	public function toArray(): array {
		return array(
			'code'    => $this->errorCode,
			'message' => $this->getMessage(),
			'fields'  => $this->fields,
			'meta'    => $this->meta,
			'status'  => $this->status,
		);
	}

	/**
	 * Create validation exception from field errors
	 *
	 * @param array  $fields Field-level errors
	 * @param string $message Optional main message
	 * @return self
	 */
	public static function withFields( array $fields, string $message = 'Validation failed' ): self {
		return new self( $message, $fields );
	}

	/**
	 * Create validation exception for single field
	 *
	 * @param string $field Field name
	 * @param string $error Error message
	 * @param string $message Optional main message
	 * @return self
	 */
	public static function forField( string $field, string $error, string $message = 'Validation failed' ): self {
		return new self( $message, array( $field => $error ) );
	}
}
