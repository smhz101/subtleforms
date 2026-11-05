<?php
/**
 * What the three clients share: sending a request and turning an error
 * answer into a plain sentence.
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
 * Requests are plain arrays (method, url, headers, body) so they can be
 * checked without a network.
 */
abstract class AbstractClient implements ClientInterface {

	/** Seconds to wait when a person is waiting in wp-admin. */
	const ADMIN_TIMEOUT = 10;

	/** Seconds to wait in the background job. */
	const JOB_TIMEOUT = 15;

	/** @var string */
	protected string $apiKey;

	/** @var int */
	protected int $timeout;

	/** @var array<string,mixed> The service's own settings (Settings > Integrations > Email marketing). */
	protected array $settings;

	/**
	 * @param string $apiKey   API key.
	 * @param int    $timeout  Seconds.
	 * @param array  $settings The service's own settings.
	 */
	public function __construct( string $apiKey, int $timeout = self::ADMIN_TIMEOUT, array $settings = array() ) {
		$this->apiKey   = trim( $apiKey );
		$this->timeout  = max( 3, $timeout );
		$this->settings = $settings;
	}

	/**
	 * The service name used in messages ("Mailchimp").
	 */
	abstract public static function serviceLabel(): string;

	/**
	 * Request headers that sign in.
	 *
	 * @return array<string,string>
	 */
	abstract protected function headers(): array;

	/**
	 * The text an error answer carries, if any.
	 *
	 * @param array $decoded Decoded body.
	 */
	abstract protected function errorDetail( array $decoded ): string;

	/**
	 * Send a request.
	 *
	 * @param array $request Method, url, headers and an optional array body.
	 * @return array{status:int,body:array}
	 * @throws ServiceException On a transport error or an answer that is not 2xx.
	 */
	public function send( array $request ): array {
		$method  = strtoupper( (string) ( $request['method'] ?? 'GET' ) );
		$headers = is_array( $request['headers'] ?? null ) ? $request['headers'] : array();
		$body    = $request['body'] ?? null;

		$headers['Accept'] = 'application/json';
		$args              = array(
			'method'      => $method,
			'headers'     => $headers,
			'timeout'     => $this->timeout,
			'redirection' => 0,
			'user-agent'  => 'SubtleForms/' . ( defined( 'SUBTLEFORMS_VERSION' ) ? SUBTLEFORMS_VERSION : '2' ) . '; ' . home_url( '/' ),
		);
		if ( is_array( $body ) && 'GET' !== $method ) {
			$args['body']                    = wp_json_encode( $body );
			$args['headers']['Content-Type'] = 'application/json';
		}

		// The safe client refuses private addresses and unusual ports. Each
		// client calls only its own service's host.
		$response = wp_safe_remote_request( (string) $request['url'], $args );
		if ( is_wp_error( $response ) ) {
			// phpcs:disable WordPress.Security.EscapeOutput.ExceptionNotEscaped -- Messages are shown as JSON or in the entry log, never printed as HTML.
			throw new ServiceException(
				sprintf(
					/* translators: 1: service name, 2: error text from the connection */
					__( 'Could not reach %1$s: %2$s', 'subtleforms' ),
					static::serviceLabel(),
					$response->get_error_message()
				),
				0,
				true
			);
			// phpcs:enable WordPress.Security.EscapeOutput.ExceptionNotEscaped
		}

		$status  = (int) wp_remote_retrieve_response_code( $response );
		$raw     = (string) wp_remote_retrieve_body( $response );
		$decoded = '' !== $raw ? json_decode( $raw, true ) : array();
		$decoded = is_array( $decoded ) ? $decoded : array();

		if ( $status < 200 || $status >= 300 ) {
			// phpcs:disable WordPress.Security.EscapeOutput.ExceptionNotEscaped -- Messages are shown as JSON or in the entry log, never printed as HTML.
			throw new ServiceException( $this->errorMessage( $status, $decoded ), $status, 429 === $status || $status >= 500 );
			// phpcs:enable WordPress.Security.EscapeOutput.ExceptionNotEscaped
		}

		return array(
			'status' => $status,
			'body'   => $decoded,
		);
	}

	/**
	 * A plain sentence for an error answer.
	 *
	 * @param int   $status  HTTP status.
	 * @param array $decoded Decoded body.
	 */
	public function errorMessage( int $status, array $decoded ): string {
		$label = static::serviceLabel();
		if ( 401 === $status || 403 === $status ) {
			/* translators: %s: service name */
			return sprintf( __( '%s did not accept this API key.', 'subtleforms' ), $label );
		}
		$detail = wp_strip_all_tags( $this->errorDetail( $decoded ) );
		if ( '' === $detail ) {
			/* translators: 1: service name, 2: HTTP status code */
			return sprintf( __( '%1$s answered with an error (HTTP %2$d).', 'subtleforms' ), $label, $status );
		}
		/* translators: 1: service name, 2: HTTP status code, 3: text from the service */
		return sprintf( __( '%1$s said (HTTP %2$d): %3$s', 'subtleforms' ), $label, $status, $detail );
	}

	/**
	 * The lowercase address a service files a person under.
	 *
	 * @param string $email Email address.
	 */
	protected static function normalizeEmail( string $email ): string {
		return strtolower( trim( $email ) );
	}

	/**
	 * Run the add-on's body filter, if there is one.
	 *
	 * @param array         $body   Request body.
	 * @param callable|null $filter Filter.
	 * @return array
	 */
	protected static function filtered( array $body, ?callable $filter ): array {
		if ( null === $filter ) {
			return $body;
		}
		$changed = $filter( $body );
		return is_array( $changed ) ? $changed : $body;
	}
}
