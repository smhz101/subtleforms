<?php
/**
 * Range checks for CouponsRepository::save(). Invalid values must be refused
 * before any row is written.
 */

namespace {
	if ( ! defined( 'ARRAY_A' ) ) {
		define( 'ARRAY_A', 'ARRAY_A' );
	}

	if ( ! function_exists( 'absint' ) ) {
		function absint( $value ) {
			return abs( (int) $value );
		}
	}

	if ( ! class_exists( 'WP_Error' ) ) {
		/**
		 * Minimal stand-in so save() can refuse without WordPress loaded.
		 */
		class WP_Error {
			public $code = '';
			public $message = '';
			public $data = '';

			/**
			 * @param string       $code    Error code.
			 * @param string       $message Error message.
			 * @param array|string $data    Error data.
			 */
			public function __construct( $code = '', $message = '', $data = '' ) {
				$this->code    = $code;
				$this->message = $message;
				$this->data    = $data;
			}

			public function get_error_code() {
				return $this->code;
			}

			public function get_error_message() {
				return $this->message;
			}
		}
	}
}

namespace SubtleForms\Tests\Unit {

	use PHPUnit\Framework\TestCase;
	use SubtleForms\Payments\CouponsRepository;

	final class CouponsRepositoryTest extends TestCase {

		protected function setUp(): void {
			parent::setUp();
			$GLOBALS['wpdb'] = new class() {
				public $prefix = 'wp_';

				public function prepare( $query, ...$args ) {
					return $query;
				}

				public function get_row( $query = null, $output = null ) {
					throw new \RuntimeException( 'validated' );
				}

				public function insert( ...$args ) {
					throw new \RuntimeException( 'inserted' );
				}
			};
		}

		protected function tearDown(): void {
			unset( $GLOBALS['wpdb'] );
			parent::tearDown();
		}

		public function test_percent_above_100_is_refused(): void {
			$result = CouponsRepository::save(
				array(
					'code'   => 'TOO',
					'type'   => 'percent',
					'amount' => 101,
				)
			);
			$this->assertInstanceOf( \WP_Error::class, $result );
			$this->assertSame( 'A percentage discount cannot be more than 100.', $result->get_error_message() );
		}

		public function test_percent_of_zero_is_refused(): void {
			$result = CouponsRepository::save(
				array(
					'code'   => 'ZERO',
					'type'   => 'percent',
					'amount' => 0,
				)
			);
			$this->assertInstanceOf( \WP_Error::class, $result );
			$this->assertSame( 'Enter a discount greater than zero.', $result->get_error_message() );
		}

		public function test_percent_of_1_and_100_pass_validation(): void {
			foreach ( array( 1, 100 ) as $amount ) {
				try {
					CouponsRepository::save(
						array(
							'code'   => 'OK' . $amount,
							'type'   => 'percent',
							'amount' => $amount,
						)
					);
					$this->fail( 'A valid percent coupon should reach lookup, not be stored here.' );
				} catch ( \RuntimeException $e ) {
					$this->assertSame( 'validated', $e->getMessage() );
				}
			}
		}

		public function test_negative_total_uses_are_refused(): void {
			$result = CouponsRepository::save(
				array(
					'code'     => 'NEG',
					'type'     => 'percent',
					'amount'   => 10,
					'max_uses' => -1,
				)
			);
			$this->assertInstanceOf( \WP_Error::class, $result );
			$this->assertSame( 'Total uses cannot be negative.', $result->get_error_message() );
		}

		public function test_negative_per_customer_uses_are_refused(): void {
			$result = CouponsRepository::save(
				array(
					'code'         => 'NEGCUST',
					'type'         => 'fixed',
					'amount'       => 5,
					'per_customer' => -3,
				)
			);
			$this->assertInstanceOf( \WP_Error::class, $result );
			$this->assertSame( 'Uses per customer cannot be negative.', $result->get_error_message() );
		}
	}
}
