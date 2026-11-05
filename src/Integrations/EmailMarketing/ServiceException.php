<?php
/**
 * A failed request to an email marketing service.
 *
 * @package SubtleForms\Integrations\EmailMarketing
 * @since   2.8.0
 */

declare(strict_types=1);

namespace SubtleForms\Integrations\EmailMarketing;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Carries the HTTP status and whether trying again later can help.
 */
final class ServiceException extends \RuntimeException {

	/** @var int */
	private int $httpStatus;

	/** @var bool */
	private bool $retryable;

	/**
	 * @param string $message   Plain reason.
	 * @param int    $status    HTTP status, 0 when the request did not get an answer.
	 * @param bool   $retryable Whether a later attempt can succeed.
	 */
	public function __construct( string $message, int $status = 0, bool $retryable = false ) {
		parent::__construct( $message, $status );
		$this->httpStatus = $status;
		$this->retryable  = $retryable;
	}

	public function status(): int {
		return $this->httpStatus;
	}

	public function isRetryable(): bool {
		return $this->retryable;
	}
}
