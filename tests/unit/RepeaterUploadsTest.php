<?php
// phpcs:disable -- Unit test file; not shipped in production plugin.
/**
 * Files uploaded in a Repeater group are resolved, kept with the entry and
 * shown by name; forged records are dropped (FA-03).
 *
 * @package SubtleForms\Tests\Unit
 */

namespace {
	if ( ! function_exists( 'get_transient' ) ) {
		function get_transient( $key ) {
			return $GLOBALS['subtleforms_test_transients'][ $key ] ?? false;
		}
	}
	if ( ! function_exists( 'delete_transient' ) ) {
		function delete_transient( $key ) {
			unset( $GLOBALS['subtleforms_test_transients'][ $key ] );
			return true;
		}
	}
	if ( ! function_exists( 'wp_upload_dir' ) ) {
		function wp_upload_dir( $time = null, $create = true ) {
			return array( 'basedir' => $GLOBALS['subtleforms_test_upload_base'] );
		}
	}
	if ( ! class_exists( 'WP_Error' ) ) {
		class WP_Error {
			public $code = '';
			public $message = '';
			public $data = '';
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
			public function get_error_data() {
				return $this->data;
			}
		}
	}
	if ( ! function_exists( 'update_option' ) ) {
		function update_option( $name, $value, $autoload = null ) {
			return true;
		}
	}
	if ( ! function_exists( 'wp_mkdir_p' ) ) {
		function wp_mkdir_p( $dir ) {
			return is_dir( $dir ) || mkdir( $dir, 0777, true );
		}
	}
}

namespace SubtleForms\Tests\Unit {

	use PHPUnit\Framework\TestCase;
	use SubtleForms\Support\FieldMapper;
	use SubtleForms\Uploads\Uploads;

	final class RepeaterUploadsTest extends TestCase {

		private string $base;

		protected function setUp(): void {
			$this->base                              = sys_get_temp_dir() . '/sf-uploads-' . uniqid();
			$GLOBALS['subtleforms_test_upload_base'] = $this->base;
			$GLOBALS['subtleforms_test_transients']  = array();
			mkdir( $this->base . '/subtleforms-uploads/pending', 0777, true );
		}

		protected function tearDown(): void {
			foreach ( array( 'pending', 'files' ) as $where ) {
				foreach ( glob( $this->base . '/subtleforms-uploads/' . $where . '/*' ) ?: array() as $f ) {
					unlink( $f );
				}
			}
		}

		private function pending( string $id, string $field, int $form = 7 ): void {
			file_put_contents( $this->base . '/subtleforms-uploads/pending/' . $id, 'hello' );
			$GLOBALS['subtleforms_test_transients'][ 'subtleforms_upload_' . $id ] = array(
				'form_id' => $form,
				'field'   => $field,
				'name'    => 'small.txt',
				'size'    => 5,
				'type'    => 'text/plain',
			);
		}

		private function schema(): array {
			return array(
				'fields' => array(
					array( 'type' => 'text', 'key' => 'note' ),
					array(
						'type'     => 'repeat_container',
						'key'      => 'items',
						'children' => array(
							array( 'type' => 'text', 'key' => 'title' ),
							array( 'type' => 'file_upload', 'key' => 'doc' ),
						),
					),
				),
			);
		}

		public function test_a_row_upload_is_resolved_to_its_record(): void {
			$id = str_repeat( 'a', 32 );
			$this->pending( $id, 'doc' );
			$out = Uploads::resolvePayload( 7, $this->schema(), array( 'items' => array( array( 'title' => 'One', 'doc' => array( $id ) ) ) ) );
			$this->assertIsArray( $out );
			$this->assertSame( 'small.txt', $out['items'][0]['doc'][0]['name'] );
			$this->assertSame( $id, Uploads::recordsIn( $out )[0]['id'] );
		}

		public function test_a_forged_record_in_a_row_is_refused(): void {
			$other = str_repeat( 'b', 32 );
			$out   = Uploads::resolvePayload(
				7,
				$this->schema(),
				array( 'items' => array( array( 'doc' => array( array( 'id' => $other, 'name' => 'forged.pdf', 'size' => 1 ) ) ) ) )
			);
			$this->assertInstanceOf( \WP_Error::class, $out );
			$data = method_exists( $out, 'get_error_data' ) ? $out->get_error_data() : $out->data;
			$this->assertArrayHasKey( 'items.0.doc', $data['errors'] );
		}

		public function test_a_record_outside_an_upload_field_is_dropped(): void {
			$other = str_repeat( 'c', 32 );
			$out   = Uploads::resolvePayload(
				7,
				$this->schema(),
				array(
					'note'  => array( array( 'id' => $other, 'name' => 'x.pdf', 'size' => 1 ) ),
					'items' => array( array( 'title' => array( array( 'id' => $other, 'name' => 'y.pdf', 'size' => 1 ) ) ) ),
				)
			);
			$this->assertSame( array(), Uploads::recordsIn( $out ) );
		}

		public function test_a_row_file_reads_as_its_name(): void {
			$record = array( 'id' => str_repeat( 'd', 32 ), 'name' => 'small.txt', 'size' => 5, 'type' => 'text/plain' );
			$this->assertSame( 'small.txt', FieldMapper::toText( array( $record ) ) );
		}
	}
}
