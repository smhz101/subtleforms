<?php
/**
 * File and image uploads for form fields.
 *
 * Flow:
 *  1. The visitor picks a file. The browser posts it to POST /uploads with the
 *     form ID and field key. The file is checked against the field's allowed
 *     types and size, stored in a protected folder under a random name with no
 *     extension, and a pending record is kept for a day. The browser gets back
 *     { id, name, size, type }.
 *  2. On submit the answer carries the upload IDs. The server swaps them for
 *     the pending records (same form, same field, not used before) and, once
 *     the entry is saved, moves the files out of the pending folder.
 *  3. Admins download files through admin-post.php, which checks the
 *     capability and a nonce. A link without a valid nonce (for example from
 *     a notification email) shows a confirmation page with a fresh one.
 *  4. Files are deleted with their entry, by data retention, and pending
 *     files nobody submitted are removed by a daily clean-up.
 *
 * @package SubtleForms\Uploads
 * @since   2.1.0
 */

namespace SubtleForms\Uploads;

use SubtleForms\Repositories\FormsRepository;
use SubtleForms\Security\RateLimiter;
use SubtleForms\Support\Capabilities;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Upload storage, REST endpoint and admin download handler.
 */
final class Uploads {

	public const FIELD_TYPES = array( 'file_upload', 'image_upload' );

	private const DIR           = 'subtleforms-uploads';
	private const PENDING       = 'pending';
	private const STORED        = 'files';
	private const TRANSIENT     = 'subtleforms_upload_';
	private const CRON_HOOK     = 'subtleforms_uploads_cleanup';
	private const NONCE_ACTION  = 'subtleforms_file';
	private const DEFAULT_FILES = 5;

	/** Extensions that are never accepted, whatever a field allows. */
	private const BLOCKED = array(
		'php', 'php3', 'php4', 'php5', 'php7', 'php8', 'phtml', 'phar', 'pht', 'phps', 'pgif',
		'shtml', 'html', 'htm', 'xhtml', 'xht', 'svg', 'svgz', 'xml', 'xsl', 'js', 'mjs', 'css',
		'exe', 'msi', 'dll', 'com', 'bat', 'cmd', 'sh', 'bash', 'zsh', 'cgi', 'pl', 'py', 'rb',
		'jsp', 'asp', 'aspx', 'ashx', 'jar', 'vbs', 'ps1', 'wsf', 'hta', 'scr', 'swf', 'htaccess',
		'htpasswd', 'ini', 'cfg', 'user.ini', 'lnk',
	);

	/** Default allowed extensions per field type. */
	private const DEFAULTS = array(
		'image_upload' => array( 'jpg', 'jpeg', 'png', 'gif', 'webp' ),
		'file_upload'  => array( 'pdf', 'doc', 'docx', 'txt', 'rtf', 'odt', 'xls', 'xlsx', 'csv', 'ppt', 'pptx', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'zip' ),
	);

	private const IMAGE_EXT = array( 'jpg', 'jpeg', 'png', 'gif', 'webp' );

	/**
	 * Wire the endpoint, download handler and clean-up.
	 */
	public static function register(): void {
		add_action( 'rest_api_init', array( self::class, 'registerRoutes' ) );
		add_action( 'admin_post_subtleforms_file', array( self::class, 'serveFile' ) );
		add_action( self::CRON_HOOK, array( self::class, 'cleanupPending' ) );
		add_action(
			'init',
			static function () {
				if ( ! wp_next_scheduled( self::CRON_HOOK ) ) {
					wp_schedule_event( time() + HOUR_IN_SECONDS, 'daily', self::CRON_HOOK );
				}
			}
		);
	}

	/**
	 * Register POST /subtleforms/v1/uploads.
	 */
	public static function registerRoutes(): void {
		register_rest_route(
			'subtleforms/v1',
			'/uploads',
			array(
				'methods'             => 'POST',
				'callback'            => array( self::class, 'handleUpload' ),
				// Public: visitors upload before they submit. Each request is
				// checked against a published form's upload field and rate limited.
				'permission_callback' => '__return_true',
				'args'                => array(
					'form_id' => array(
						'type'              => 'integer',
						'required'          => true,
						'sanitize_callback' => 'absint',
					),
					'field'   => array(
						'type'              => 'string',
						'required'          => true,
						'sanitize_callback' => 'sanitize_key',
					),
				),
			)
		);
	}

	// ── Upload ───────────────────────────────────────────────────────────

	/**
	 * Store one uploaded file as pending.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response
	 */
	public static function handleUpload( WP_REST_Request $request ): WP_REST_Response {
		$ip    = isset( $_SERVER['REMOTE_ADDR'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) ) : '';
		$limit = RateLimiter::check( 'subtleforms_rl_upload_' . md5( $ip ), 30, 10 * MINUTE_IN_SECONDS );
		if ( empty( $limit['allowed'] ) ) {
			return self::error( 'subtleforms_upload_rate', __( 'Too many uploads. Please wait a few minutes and try again.', 'subtleforms' ), 429 );
		}

		$formId   = (int) $request->get_param( 'form_id' );
		$fieldKey = (string) $request->get_param( 'field' );
		$field    = self::findUploadField( $formId, $fieldKey );
		if ( $field === null ) {
			return self::error( 'subtleforms_upload_field', __( 'This form does not accept uploads here.', 'subtleforms' ), 404 );
		}

		$files = $request->get_file_params();
		$file  = $files['file'] ?? null;
		if ( ! is_array( $file ) || ! isset( $file['tmp_name'], $file['name'], $file['size'] ) || is_array( $file['name'] ) ) {
			return self::error( 'subtleforms_upload_missing', __( 'No file was received.', 'subtleforms' ), 400 );
		}
		if ( (int) ( $file['error'] ?? UPLOAD_ERR_NO_FILE ) !== UPLOAD_ERR_OK ) {
			$tooBig = in_array( (int) $file['error'], array( UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE ), true );
			return self::error(
				'subtleforms_upload_failed',
				$tooBig ? __( 'This file is too large.', 'subtleforms' ) : __( 'The file could not be uploaded. Please try again.', 'subtleforms' ),
				400
			);
		}

		$checked = self::checkFile( $field, (string) $file['tmp_name'], (string) $file['name'], (int) $file['size'] );
		if ( $checked instanceof WP_Error ) {
			return self::error( $checked->get_error_code(), $checked->get_error_message(), 400 );
		}

		$dir = self::dir( self::PENDING );
		if ( $dir === null ) {
			return self::error( 'subtleforms_upload_storage', __( 'Uploads are not available right now.', 'subtleforms' ), 500 );
		}

		$id    = bin2hex( random_bytes( 16 ) );
		$moved = self::storeUpload( $file, $dir, $id );
		if ( ! $moved ) {
			return self::error( 'subtleforms_upload_storage', __( 'The file could not be saved. Please try again.', 'subtleforms' ), 500 );
		}

		$record = array(
			'id'   => $id,
			'name' => $checked['name'],
			'size' => (int) $file['size'],
			'type' => $checked['type'],
		);
		set_transient(
			self::TRANSIENT . $id,
			array_merge(
				$record,
				array(
					'form_id' => $formId,
					'field'   => $fieldKey,
				)
			),
			DAY_IN_SECONDS
		);

		return new WP_REST_Response( array( 'data' => $record ), 201 );
	}

	/**
	 * Check a file against a field's rules.
	 *
	 * @param array  $field Field node.
	 * @param string $tmp   Temporary path.
	 * @param string $name  Original file name.
	 * @param int    $size  Size in bytes.
	 * @return array{name:string,type:string,ext:string}|WP_Error
	 */
	public static function checkFile( array $field, string $tmp, string $name, int $size ) {
		$name = sanitize_file_name( wp_basename( $name ) );
		$ext  = strtolower( (string) pathinfo( $name, PATHINFO_EXTENSION ) );

		if ( $size <= 0 ) {
			return new WP_Error( 'subtleforms_upload_empty', __( 'This file is empty.', 'subtleforms' ) );
		}
		$max = self::maxBytes( $field );
		if ( $size > $max ) {
			return new WP_Error(
				'subtleforms_upload_size',
				/* translators: %s: maximum file size, e.g. 5 MB */
				sprintf( __( 'This file is too large. The limit is %s.', 'subtleforms' ), size_format( $max ) )
			);
		}

		$allowed = self::allowedExtensions( $field );
		if ( $ext === '' || ! in_array( $ext, $allowed, true ) || self::isBlocked( $name ) ) {
			return new WP_Error(
				'subtleforms_upload_type',
				/* translators: %s: list of file extensions */
				sprintf( __( 'This type of file is not allowed. Allowed: %s.', 'subtleforms' ), implode( ', ', $allowed ) )
			);
		}

		// The content must match the extension (WordPress uses fileinfo).
		$real = wp_check_filetype_and_ext( $tmp, $name );
		if ( empty( $real['ext'] ) || empty( $real['type'] ) || strtolower( (string) $real['ext'] ) !== $ext ) {
			$sameFamily = ! empty( $real['ext'] ) && in_array( strtolower( (string) $real['ext'] ), array( 'jpg', 'jpeg' ), true ) && in_array( $ext, array( 'jpg', 'jpeg' ), true );
			if ( ! $sameFamily ) {
				return new WP_Error( 'subtleforms_upload_type', __( 'The file’s contents do not match its type.', 'subtleforms' ) );
			}
		}
		if ( in_array( $ext, self::IMAGE_EXT, true ) && ! @getimagesize( $tmp ) ) { // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged -- Invalid images return false with a warning.
			return new WP_Error( 'subtleforms_upload_type', __( 'This image could not be read.', 'subtleforms' ) );
		}
		if ( ( $field['type'] ?? '' ) === 'image_upload' && ! in_array( $ext, self::IMAGE_EXT, true ) ) {
			return new WP_Error( 'subtleforms_upload_type', __( 'Please choose an image.', 'subtleforms' ) );
		}

		return array(
			'name' => $name,
			'type' => (string) $real['type'],
			'ext'  => $ext,
		);
	}

	/**
	 * Largest file a field accepts, in bytes (never above the server limit).
	 *
	 * @param array $field Field node.
	 */
	public static function maxBytes( array $field ): int {
		$server = (int) wp_max_upload_size();
		$set    = (int) self::attr( $field, 'maxSize', 0 );
		if ( $set <= 0 ) {
			$set = ( $field['type'] ?? '' ) === 'image_upload' ? 5 * MB_IN_BYTES : 10 * MB_IN_BYTES;
		}
		return $server > 0 ? min( $set, $server ) : $set;
	}

	/**
	 * Extensions a field accepts, minus anything blocked.
	 *
	 * Reads `allowedExtensions` (list or comma string), else maps the older
	 * `allowedTypes` MIME list, else the type's defaults.
	 *
	 * @param array $field Field node.
	 * @return string[]
	 */
	public static function allowedExtensions( array $field ): array {
		$type = (string) ( $field['type'] ?? 'file_upload' );
		$exts = array();

		$set = self::attr( $field, 'allowedExtensions', null );
		if ( is_string( $set ) ) {
			$set = explode( ',', $set );
		}
		if ( is_array( $set ) ) {
			foreach ( $set as $e ) {
				$e = strtolower( trim( ltrim( (string) $e, '. ' ) ) );
				if ( $e !== '' && preg_match( '/^[a-z0-9]{1,10}$/', $e ) ) {
					$exts[] = $e;
				}
			}
		}

		if ( ! $exts ) {
			$mimes = self::attr( $field, 'allowedTypes', null );
			if ( is_array( $mimes ) && $mimes ) {
				foreach ( wp_get_mime_types() as $pattern => $mime ) {
					if ( in_array( $mime, $mimes, true ) ) {
						$exts = array_merge( $exts, explode( '|', $pattern ) );
					}
				}
			}
		}

		if ( ! $exts ) {
			$exts = self::DEFAULTS[ $type ] ?? self::DEFAULTS['file_upload'];
		}
		if ( $type === 'image_upload' ) {
			$exts = array_intersect( $exts, self::IMAGE_EXT );
		}

		// Never anything WordPress itself would refuse, or that could run.
		$wpAllowed = array();
		foreach ( array_keys( get_allowed_mime_types() ) as $pattern ) {
			$wpAllowed = array_merge( $wpAllowed, explode( '|', $pattern ) );
		}
		$exts = array_filter(
			array_unique( $exts ),
			static fn( $e ) => ! in_array( $e, self::BLOCKED, true ) && in_array( $e, $wpAllowed, true )
		);

		return array_values( $exts );
	}

	/**
	 * Whether a file name carries a blocked extension anywhere (a.php.jpg).
	 */
	private static function isBlocked( string $name ): bool {
		$parts = explode( '.', strtolower( $name ) );
		array_shift( $parts );
		foreach ( $parts as $part ) {
			if ( in_array( $part, self::BLOCKED, true ) ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Most files one field accepts.
	 *
	 * @param array $field Field node.
	 */
	public static function maxFiles( array $field ): int {
		if ( ! self::attr( $field, 'multiple', false ) ) {
			return 1;
		}
		$n = (int) self::attr( $field, 'maxFiles', 0 );
		return $n > 0 ? min( $n, 20 ) : self::DEFAULT_FILES;
	}

	// ── Submit ───────────────────────────────────────────────────────────

	/**
	 * Swap upload IDs in a payload for the pending file records.
	 *
	 * Upload fields inside a Repeater are resolved in every group (FA-03).
	 * A file record anywhere else in the payload was not made here, so it is
	 * dropped: a forged record can never point an entry at another entry's
	 * file.
	 *
	 * @param int   $formId  Form ID.
	 * @param mixed $schema  Active schema.
	 * @param array $payload Payload keyed by field key.
	 * @return array|WP_Error Payload, or an error keyed to the field.
	 */
	public static function resolvePayload( int $formId, $schema, array $payload ) {
		$nodes    = is_array( $schema ) ? ( $schema['fields'] ?? array() ) : array();
		$errors   = array();
		$resolved = array();
		$skip     = array();

		foreach ( self::uploadFields( $nodes, true ) as $key => $field ) {
			if ( ! array_key_exists( $key, $payload ) ) {
				continue;
			}
			$skip[ $key ] = true;
			$value        = self::resolveValue( $formId, (string) $key, $field, $payload[ $key ], $error );
			if ( null === $value ) {
				$errors[ $key ] = $error;
				continue;
			}
			$payload[ $key ] = $value;
			$resolved        = array_merge( $resolved, array_column( $value, 'id' ) );
		}

		foreach ( self::repeaters( $nodes ) as $rkey => $children ) {
			if ( ! array_key_exists( $rkey, $payload ) || ! is_array( $payload[ $rkey ] ) ) {
				continue;
			}
			$skip[ $rkey ] = true;
			$groups        = $payload[ $rkey ];
			foreach ( $groups as $index => $group ) {
				if ( ! is_array( $group ) ) {
					continue;
				}
				foreach ( $children as $ckey => $field ) {
					if ( ! array_key_exists( $ckey, $group ) ) {
						continue;
					}
					$value = self::resolveValue( $formId, (string) $ckey, $field, $group[ $ckey ], $error );
					if ( null === $value ) {
						$errors[ $rkey . '.' . $index . '.' . $ckey ] = $error;
						continue;
					}
					$group[ $ckey ] = $value;
					$resolved       = array_merge( $resolved, array_column( $value, 'id' ) );
				}
				// Anything else in the group that looks like a file record
				// was not uploaded through this form.
				foreach ( $group as $ckey => $v ) {
					if ( ! isset( $children[ $ckey ] ) ) {
						$group[ $ckey ] = self::withoutRecords( $v );
					}
				}
				$groups[ $index ] = $group;
			}
			$payload[ $rkey ] = $groups;
		}

		foreach ( $payload as $key => $value ) {
			if ( ! isset( $skip[ $key ] ) ) {
				$payload[ $key ] = self::withoutRecords( $value );
			}
		}

		if ( $errors ) {
			return new WP_Error( 'subtleforms_upload_invalid', __( 'Please check the attached files.', 'subtleforms' ), array( 'errors' => $errors ) );
		}
		return $payload;
	}

	/**
	 * The pending file records for one upload answer.
	 *
	 * @param int         $formId Form ID.
	 * @param string      $key    Field key the files were uploaded to.
	 * @param array       $field  Upload field.
	 * @param mixed       $value  Submitted IDs.
	 * @param string|null $error  Set to the message when the answer is refused.
	 * @return array|null Records, or null when refused.
	 */
	private static function resolveValue( int $formId, string $key, array $field, $value, ?string &$error = null ): ?array {
		$error = null;
		$ids   = self::idsFrom( $value );
		if ( ! $ids ) {
			return array();
		}
		if ( count( $ids ) > self::maxFiles( $field ) ) {
			$error = sprintf(
				/* translators: %d: number of files */
				_n( 'You can attach up to %d file.', 'You can attach up to %d files.', self::maxFiles( $field ), 'subtleforms' ),
				self::maxFiles( $field )
			);
			return null;
		}
		$records = array();
		foreach ( $ids as $id ) {
			$pending = get_transient( self::TRANSIENT . $id );
			if ( ! is_array( $pending ) || (int) ( $pending['form_id'] ?? 0 ) !== $formId || ( $pending['field'] ?? '' ) !== $key || ! is_file( self::path( self::PENDING, $id ) ) ) {
				$error = __( 'An attached file has expired. Please attach it again.', 'subtleforms' );
				return null;
			}
			$records[] = array(
				'id'   => $id,
				'name' => (string) $pending['name'],
				'size' => (int) $pending['size'],
				'type' => (string) $pending['type'],
			);
		}
		return $records;
	}

	/**
	 * A value with every file record taken out.
	 *
	 * @param mixed $value Value.
	 * @return mixed
	 */
	private static function withoutRecords( $value, int $depth = 0 ) {
		if ( ! is_array( $value ) || $depth > 8 ) {
			return $value;
		}
		if ( self::isRecord( $value ) ) {
			return null;
		}
		$isList = array_is_list( $value );
		foreach ( $value as $k => $v ) {
			if ( self::isRecord( $v ) ) {
				unset( $value[ $k ] );
				continue;
			}
			$value[ $k ] = self::withoutRecords( $v, $depth + 1 );
		}
		return $isList ? array_values( $value ) : $value;
	}

	/**
	 * Repeaters in a field tree with their upload fields, by Repeater key.
	 *
	 * @param mixed $nodes Field nodes.
	 * @return array<string,array<string,array>>
	 */
	private static function repeaters( $nodes ): array {
		$out = array();
		if ( ! is_array( $nodes ) ) {
			return $out;
		}
		foreach ( $nodes as $node ) {
			if ( ! is_array( $node ) ) {
				continue;
			}
			$key = $node['key'] ?? ( $node['config']['key'] ?? null );
			if ( 'repeat_container' === ( $node['type'] ?? '' ) && is_string( $key ) && '' !== $key ) {
				$children = array();
				foreach ( array( 'children', 'fields' ) as $k ) {
					if ( isset( $node[ $k ] ) && is_array( $node[ $k ] ) ) {
						$children += self::uploadFields( $node[ $k ] );
					}
				}
				$out[ $key ] = $children;
				continue;
			}
			foreach ( self::childLists( $node ) as $list ) {
				$out += self::repeaters( $list );
			}
		}
		return $out;
	}

	/**
	 * Child field lists of a node: children, fields and columns.
	 *
	 * @param array $node Node.
	 * @return array<int,array>
	 */
	private static function childLists( array $node ): array {
		$lists = array();
		foreach ( array( 'children', 'fields' ) as $k ) {
			if ( isset( $node[ $k ] ) && is_array( $node[ $k ] ) ) {
				$lists[] = $node[ $k ];
			}
		}
		if ( isset( $node['columns'] ) && is_array( $node['columns'] ) ) {
			foreach ( $node['columns'] as $col ) {
				if ( is_array( $col ) ) {
					$lists[] = isset( $col['fields'] ) || isset( $col['children'] ) ? ( $col['fields'] ?? $col['children'] ) : $col;
				}
			}
		}
		return $lists;
	}

	/**
	 * Move a saved entry's files out of the pending folder.
	 *
	 * @param array $payload Stored payload.
	 */
	public static function claim( array $payload ): void {
		$dir = self::dir( self::STORED );
		if ( $dir === null ) {
			return;
		}
		foreach ( self::recordsIn( $payload ) as $record ) {
			$from = self::path( self::PENDING, $record['id'] );
			if ( is_file( $from ) ) {
				self::filesystem()->move( $from, $dir . '/' . $record['id'], true );
			}
			delete_transient( self::TRANSIENT . $record['id'] );
		}
	}

	/**
	 * Delete the files referenced by an entry's payload.
	 *
	 * @param mixed $payload Stored payload (array or JSON string).
	 */
	public static function deleteForPayload( $payload ): int {
		if ( is_string( $payload ) ) {
			$payload = json_decode( $payload, true );
		}
		if ( ! is_array( $payload ) ) {
			return 0;
		}
		$deleted = 0;
		foreach ( self::recordsIn( $payload ) as $record ) {
			foreach ( array( self::STORED, self::PENDING ) as $where ) {
				$file = self::path( $where, $record['id'] );
				if ( is_file( $file ) ) {
					wp_delete_file( $file );
					++$deleted;
				}
			}
		}
		return $deleted;
	}

	/**
	 * File records found anywhere in a payload, including Repeater groups.
	 *
	 * @param array $payload Payload.
	 * @return array<int,array{id:string,name:string,size:int,type:string}>
	 */
	public static function recordsIn( array $payload ): array {
		$out  = array();
		$walk = static function ( $value, int $depth ) use ( &$walk, &$out ) {
			if ( ! is_array( $value ) || $depth > 8 ) {
				return;
			}
			if ( self::isRecord( $value ) ) {
				$out[] = $value;
				return;
			}
			// Repeater groups (FA-03) hold upload answers one level down.
			foreach ( $value as $item ) {
				$walk( $item, $depth + 1 );
			}
		};
		foreach ( $payload as $value ) {
			if ( is_array( $value ) ) {
				foreach ( $value as $item ) {
					$walk( $item, 0 );
				}
			}
		}
		return $out;
	}

	/**
	 * Whether a value is a stored file record.
	 *
	 * @param mixed $item Value.
	 */
	public static function isRecord( $item ): bool {
		return is_array( $item )
			&& isset( $item['id'], $item['name'] )
			&& is_string( $item['id'] )
			&& preg_match( '/^[a-f0-9]{32}$/', $item['id'] ) === 1
			&& array_key_exists( 'size', $item );
	}

	/**
	 * Admin download URL for a stored file. Without a nonce it opens a
	 * confirmation page; pass $withNonce for links shown in wp-admin.
	 */
	public static function downloadUrl( int $submissionId, string $fileId, bool $withNonce = false ): string {
		$args = array(
			'action' => 'subtleforms_file',
			'entry'  => $submissionId,
			'file'   => $fileId,
		);
		if ( $withNonce ) {
			$args['_wpnonce'] = wp_create_nonce( self::NONCE_ACTION );
		}
		return add_query_arg( $args, admin_url( 'admin-post.php' ) );
	}

	/**
	 * Nonce for download links built in the admin app.
	 */
	public static function nonce(): string {
		return wp_create_nonce( self::NONCE_ACTION );
	}

	// ── Download ─────────────────────────────────────────────────────────

	/**
	 * admin-post.php?action=subtleforms_file&entry=N&file=ID&_wpnonce=…
	 */
	public static function serveFile(): void {
		$caps = new Capabilities();
		if ( ! is_user_logged_in() || ! current_user_can( $caps->manage_cap() ) ) {
			wp_die( esc_html__( 'You are not allowed to download this file.', 'subtleforms' ), 403 );
		}

		// phpcs:disable WordPress.Security.NonceVerification.Recommended -- The nonce is verified below; without one a confirmation page is shown instead.
		$entry  = isset( $_GET['entry'] ) ? absint( $_GET['entry'] ) : 0;
		$fileId = isset( $_GET['file'] ) ? sanitize_key( wp_unslash( $_GET['file'] ) ) : '';
		$nonce  = isset( $_GET['_wpnonce'] ) ? sanitize_text_field( wp_unslash( $_GET['_wpnonce'] ) ) : '';
		// phpcs:enable WordPress.Security.NonceVerification.Recommended

		if ( ! $entry || ! preg_match( '/^[a-f0-9]{32}$/', $fileId ) ) {
			wp_die( esc_html__( 'File not found.', 'subtleforms' ), 404 );
		}

		$submission = ( new \SubtleForms\Repositories\SubmissionsRepository() )->find( $entry );
		$payload    = is_array( $submission ) ? ( $submission['payload'] ?? array() ) : array();
		if ( is_string( $payload ) ) {
			$payload = json_decode( $payload, true );
		}
		$record = null;
		foreach ( self::recordsIn( is_array( $payload ) ? $payload : array() ) as $r ) {
			if ( $r['id'] === $fileId ) {
				$record = $r;
				break;
			}
		}
		$path = $record ? self::path( self::STORED, $fileId ) : '';
		if ( ! $record || ! is_file( $path ) ) {
			wp_die( esc_html__( 'File not found.', 'subtleforms' ), 404 );
		}

		if ( ! wp_verify_nonce( $nonce, self::NONCE_ACTION ) ) {
			$url = self::downloadUrl( $entry, $fileId, true );
			wp_die(
				sprintf(
					'<p>%s</p><p><strong>%s</strong> (%s)</p><p><a class="button button-primary" href="%s">%s</a></p>',
					esc_html__( 'Download this file from the entry?', 'subtleforms' ),
					esc_html( $record['name'] ),
					esc_html( size_format( (int) $record['size'] ) ),
					esc_url( $url ),
					esc_html__( 'Download', 'subtleforms' )
				),
				esc_html__( 'Download file', 'subtleforms' ),
				array( 'response' => 200 )
			);
		}

		$name = sanitize_file_name( (string) $record['name'] );
		nocache_headers();
		header( 'Content-Type: application/octet-stream' );
		header( 'Content-Disposition: attachment; filename="' . str_replace( '"', '', $name ) . '"; filename*=UTF-8\'\'' . rawurlencode( $name ) );
		$contents = (string) self::filesystem()->get_contents( $path );
		header( 'Content-Length: ' . (string) strlen( $contents ) );
		header( 'X-Content-Type-Options: nosniff' );
		header( "Content-Security-Policy: default-src 'none'; sandbox" );
		echo $contents; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- A file download, sent as an attachment with a sandbox policy.
		exit;
	}

	// ── Housekeeping ─────────────────────────────────────────────────────

	/**
	 * Remove pending files older than a day (never submitted).
	 */
	public static function cleanupPending(): int {
		$dir = self::dir( self::PENDING );
		if ( $dir === null ) {
			return 0;
		}
		$removed = 0;
		foreach ( (array) glob( $dir . '/*' ) as $file ) {
			$base = basename( (string) $file );
			if ( preg_match( '/^[a-f0-9]{32}$/', $base ) && filemtime( (string) $file ) < time() - DAY_IN_SECONDS ) {
				wp_delete_file( (string) $file );
				++$removed;
			}
		}
		return $removed;
	}

	// ── Internals ────────────────────────────────────────────────────────

	/**
	 * The upload field with this key on a published form, or null.
	 */
	private static function findUploadField( int $formId, string $key ): ?array {
		if ( $formId <= 0 || $key === '' ) {
			return null;
		}
		$repo = new FormsRepository();
		$form = $repo->find( $formId );
		if ( ! $form || ( $form['status'] ?? '' ) !== 'published' ) {
			return null;
		}
		try {
			$active = $repo->loadSchemaVersion( $formId );
		} catch ( \RuntimeException $e ) {
			return null;
		}
		$schema = is_array( $active ) ? ( $active['schema'] ?? $active ) : array();
		$fields = self::uploadFields( is_array( $schema ) ? ( $schema['fields'] ?? array() ) : array() );
		return $fields[ $key ] ?? null;
	}

	/**
	 * Upload fields in a field tree, keyed by field key.
	 *
	 * @param mixed $nodes            Field nodes.
	 * @param bool  $outsideRepeaters Leave out fields inside a Repeater.
	 * @return array<string,array>
	 */
	public static function uploadFields( $nodes, bool $outsideRepeaters = false ): array {
		$out = array();
		if ( ! is_array( $nodes ) ) {
			return $out;
		}
		foreach ( $nodes as $node ) {
			if ( ! is_array( $node ) ) {
				continue;
			}
			$key = $node['key'] ?? ( $node['config']['key'] ?? null );
			if ( is_string( $key ) && $key !== '' && in_array( $node['type'] ?? '', self::FIELD_TYPES, true ) ) {
				$out[ $key ] = $node;
			}
			// A Repeater's upload fields answer inside its groups.
			if ( $outsideRepeaters && 'repeat_container' === ( $node['type'] ?? '' ) ) {
				continue;
			}
			foreach ( self::childLists( $node ) as $list ) {
				$out += self::uploadFields( $list, $outsideRepeaters );
			}
		}
		return $out;
	}

	/**
	 * Upload IDs in a submitted answer: an ID, a list of IDs or of { id }.
	 *
	 * @param mixed $value Answer.
	 * @return string[]
	 */
	private static function idsFrom( $value ): array {
		$items = is_array( $value ) && ( isset( $value['id'] ) ) ? array( $value ) : ( is_array( $value ) ? $value : array( $value ) );
		$ids   = array();
		foreach ( $items as $item ) {
			$id = is_array( $item ) ? ( $item['id'] ?? '' ) : $item;
			if ( is_string( $id ) && preg_match( '/^[a-f0-9]{32}$/', $id ) ) {
				$ids[] = $id;
			}
		}
		return array_values( array_unique( $ids ) );
	}

	/**
	 * A field setting from the node or its config.
	 *
	 * @param array  $field   Field node.
	 * @param string $name    Setting.
	 * @param mixed  $default Default.
	 * @return mixed
	 */
	private static function attr( array $field, string $name, $default ) {
		if ( array_key_exists( $name, $field ) ) {
			return $field[ $name ];
		}
		if ( isset( $field['config'] ) && is_array( $field['config'] ) && array_key_exists( $name, $field['config'] ) ) {
			return $field['config'][ $name ];
		}
		return $default;
	}

	/**
	 * Path of a stored or pending file.
	 */
	private static function path( string $where, string $id ): string {
		$base = self::baseDir();
		return $base . '/' . $where . '/' . $id;
	}

	private static function baseDir(): string {
		$uploads = wp_upload_dir( null, false );
		return rtrim( (string) $uploads['basedir'], '/' ) . '/' . self::folderName();
	}

	/**
	 * The private uploads folder name.
	 *
	 * New sites get a random name that cannot be guessed, so files stay
	 * private on servers that ignore .htaccess, such as nginx (FA-18). A site
	 * that already stores files keeps its folder.
	 */
	public static function folderName(): string {
		$name = (string) get_option( 'subtleforms_upload_folder', '' );
		if ( 1 === preg_match( '/^subtleforms-uploads(-[a-z0-9]{16})?$/', $name ) ) {
			return $name;
		}
		$uploads = wp_upload_dir( null, false );
		$legacy  = rtrim( (string) $uploads['basedir'], '/' ) . '/' . self::DIR;
		$name    = is_dir( $legacy ) ? self::DIR : self::DIR . '-' . bin2hex( random_bytes( 8 ) );
		update_option( 'subtleforms_upload_folder', $name, false );
		return $name;
	}

	/**
	 * Move an uploaded file into the private folder with wp_handle_upload()
	 * (WP2-18). The file is saved under its random ID, with no extension, so
	 * it can never run as a script.
	 *
	 * @param array  $file $_FILES entry.
	 * @param string $dir  Destination folder.
	 * @param string $id   File ID.
	 */
	private static function storeUpload( array $file, string $dir, string $id ): bool {
		if ( ! function_exists( 'wp_handle_upload' ) ) {
			require_once ABSPATH . 'wp-admin/includes/file.php';
		}
		$to_dir = static function ( $paths ) use ( $dir ) {
			$paths['path']   = $dir;
			$paths['subdir'] = '';
			return $paths;
		};
		add_filter( 'upload_dir', $to_dir, PHP_INT_MAX );
		$result = wp_handle_upload(
			$file,
			array(
				'test_form'                => false,
				// The type was checked against the field's rules already.
				'test_type'                => false,
				'unique_filename_callback' => static function () use ( $id ) {
					return $id;
				},
			)
		);
		remove_filter( 'upload_dir', $to_dir, PHP_INT_MAX );
		return is_array( $result ) && empty( $result['error'] ) && is_file( $dir . '/' . $id );
	}

	/**
	 * The WordPress filesystem, set up for direct access to our own folder.
	 *
	 * @return \WP_Filesystem_Base
	 */
	private static function filesystem() {
		global $wp_filesystem;
		if ( ! $wp_filesystem instanceof \WP_Filesystem_Base ) {
			if ( ! function_exists( 'WP_Filesystem' ) ) {
				require_once ABSPATH . 'wp-admin/includes/file.php';
			}
			WP_Filesystem();
		}
		if ( ! $wp_filesystem instanceof \WP_Filesystem_Base || 'direct' !== $wp_filesystem->method ) {
			if ( ! class_exists( 'WP_Filesystem_Direct' ) ) {
				require_once ABSPATH . 'wp-admin/includes/class-wp-filesystem-base.php';
				require_once ABSPATH . 'wp-admin/includes/class-wp-filesystem-direct.php';
			}
			return new \WP_Filesystem_Direct( null );
		}
		return $wp_filesystem;
	}

	/**
	 * A protected sub-folder, created on first use, or null.
	 */
	private static function dir( string $where ): ?string {
		$base = self::baseDir();
		$dir  = $base . '/' . $where;
		if ( ! is_dir( $dir ) && ! wp_mkdir_p( $dir ) ) {
			return null;
		}
		self::protect( $base );
		self::protect( $dir );
		return $dir;
	}

	/**
	 * Deny direct web access (Apache, LiteSpeed, IIS) and directory listing.
	 * On other servers the random, extension-less names keep files private
	 * and stop them being run.
	 */
	private static function protect( string $dir ): void {
		$files = array(
			'.htaccess'  => "# SubtleForms uploads: served only through wp-admin.\n<IfModule mod_authz_core.c>\n\tRequire all denied\n</IfModule>\n<IfModule !mod_authz_core.c>\n\tDeny from all\n</IfModule>\nOptions -Indexes\n",
			'index.php'  => "<?php\n// Silence is golden.\n",
			'web.config' => "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<configuration><system.webServer><authorization><deny users=\"*\" /></authorization></system.webServer></configuration>\n",
		);
		foreach ( $files as $name => $contents ) {
			if ( ! file_exists( $dir . '/' . $name ) ) {
				self::filesystem()->put_contents( $dir . '/' . $name, $contents, defined( 'FS_CHMOD_FILE' ) ? FS_CHMOD_FILE : 0644 );
			}
		}
	}

	private static function error( string $code, string $message, int $status ): WP_REST_Response {
		return new WP_REST_Response(
			array(
				'success' => false,
				'error'   => array(
					'code'    => $code,
					'message' => $message,
				),
			),
			$status
		);
	}
}
