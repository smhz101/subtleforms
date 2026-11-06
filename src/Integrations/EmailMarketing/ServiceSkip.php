<?php
/**
 * A person a service chose not to add, on purpose.
 *
 * @package SubtleForms\Integrations\EmailMarketing
 * @since   2.9.0
 */

declare(strict_types=1);

namespace SubtleForms\Integrations\EmailMarketing;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Not an error: the service already knows this person and they must not be
 * subscribed again (MailPoet: someone who unsubscribed, or whose address
 * bounced). The sender writes the message to the entry's activity log as a
 * skipped line and does not try again.
 */
final class ServiceSkip extends \RuntimeException {

	/** @var string */
	private string $code_name;

	/**
	 * @param string $message Line for the entry log, in plain words.
	 * @param string $reason  Short machine reason (`previously_unsubscribed`, `bounced`).
	 */
	public function __construct( string $message, string $reason ) {
		parent::__construct( $message );
		$this->code_name = $reason;
	}

	public function reason(): string {
		return $this->code_name;
	}
}
