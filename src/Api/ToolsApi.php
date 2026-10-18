<?php
/**
 * Tools: transfer, migration and logs.
 *
 * @package SubtleForms\Api
 */

namespace SubtleForms\Api;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use SubtleForms\Repositories\FormsRepository;
use SubtleForms\Repositories\LogsRepository;
use SubtleForms\Repositories\SubmissionsRepository;
use SubtleForms\Support\FeatureGate;
use SubtleForms\Tools\ApiLog;
use SubtleForms\Tools\FormMigration;
use SubtleForms\Tools\TransferService;
use WP_REST_Request;
use WP_REST_Response;

/**
 * REST endpoints for the Tools page.
 */
final class ToolsApi {

	use ApiGuards;

	private const NAMESPACE = 'subtleforms/v1';

	/** @var FormsRepository */
	private $forms;

	/** @var SubmissionsRepository */
	private $submissions;

	/** @var FeatureGate */
	private $gate;

	/** @var TransferService */
	private $transfer;

	/**
	 * @param FormsRepository       $forms Forms.
	 * @param SubmissionsRepository $submissions Submissions.
	 * @param FeatureGate           $gate Gate.
	 */
	public function __construct( FormsRepository $forms, SubmissionsRepository $submissions, FeatureGate $gate ) {
		$this->forms       = $forms;
		$this->submissions = $submissions;
		$this->gate        = $gate;
		$this->transfer    = new TransferService( $forms, $submissions );
	}

	/**
	 * @return FeatureGate
	 */
	protected function getGate(): FeatureGate {
		return $this->gate;
	}

	/**
	 * Register routes.
	 */
	public function registerRoutes(): void {
		$read  = array( $this, 'check_read_permission' );
		$write = array( $this, 'check_write_permission' );

		register_rest_route(
			self::NAMESPACE,
			'/tools/forms/export',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'exportForms' ),
				'permission_callback' => $read,
			)
		);
		register_rest_route(
			self::NAMESPACE,
			'/tools/forms/import',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'importForms' ),
				'permission_callback' => $write,
			)
		);
		register_rest_route(
			self::NAMESPACE,
			'/tools/submissions/export',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'exportSubmissions' ),
				'permission_callback' => $read,
			)
		);
		register_rest_route(
			self::NAMESPACE,
			'/tools/submissions/import',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'importSubmissions' ),
				'permission_callback' => $write,
			)
		);
		register_rest_route(
			self::NAMESPACE,
			'/tools/migrate/preview',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'previewMigration' ),
				'permission_callback' => $write,
			)
		);
		register_rest_route(
			self::NAMESPACE,
			'/tools/migrate/import',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'importMigration' ),
				'permission_callback' => $write,
			)
		);
		register_rest_route(
			self::NAMESPACE,
			'/tools/logs',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'logs' ),
				'permission_callback' => $read,
			)
		);
		register_rest_route(
			self::NAMESPACE,
			'/tools/api-logs',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'apiLogs' ),
				'permission_callback' => $read,
			)
		);
	}

	/**
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response
	 */
	public function exportForms( WP_REST_Request $request ): WP_REST_Response {
		$raw = (string) $request->get_param( 'ids' );
		$ids = $raw === '' ? array() : array_map( 'intval', explode( ',', $raw ) );
		return ApiResponse::success( $this->transfer->exportForms( $ids ) );
	}

	/**
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response
	 */
	public function importForms( WP_REST_Request $request ): WP_REST_Response {
		$package = $request->get_json_params();
		if ( ! is_array( $package ) ) {
			return ApiResponse::validation_error( __( 'The file could not be read.', 'subtleforms' ) );
		}
		$result = $this->transfer->importForms( $package );
		if ( $result['error'] !== '' && ! $result['created'] ) {
			return ApiResponse::validation_error( $result['error'] );
		}
		return ApiResponse::success( $result );
	}

	/**
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response
	 */
	public function exportSubmissions( WP_REST_Request $request ): WP_REST_Response {
		$formId = (int) $request->get_param( 'form_id' );
		if ( $formId <= 0 ) {
			return ApiResponse::validation_error( __( 'Choose a form to export.', 'subtleforms' ) );
		}
		return ApiResponse::success( $this->transfer->exportSubmissions( $formId ) );
	}

	/**
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response
	 */
	public function importSubmissions( WP_REST_Request $request ): WP_REST_Response {
		$body   = $request->get_json_params();
		$body   = is_array( $body ) ? $body : array();
		$formId = (int) ( $body['form_id'] ?? 0 );
		$package = $body['package'] ?? null;
		if ( ! is_array( $package ) ) {
			return ApiResponse::validation_error( __( 'The file could not be read.', 'subtleforms' ) );
		}
		$result = $this->transfer->importSubmissions( $formId, $package );
		if ( $result['error'] !== '' && 0 === $result['imported'] ) {
			return ApiResponse::validation_error( $result['error'] );
		}
		return ApiResponse::success( $result );
	}

	/**
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response
	 */
	public function previewMigration( WP_REST_Request $request ): WP_REST_Response {
		$body = $this->migrationBody( $request );
		if ( $body instanceof WP_REST_Response ) {
			return $body;
		}
		$detected = FormMigration::detect( $body['package'] );
		$source   = $body['source'] !== '' ? $body['source'] : $detected;
		if ( ! in_array( $source, array( 'gravity', 'fluent' ), true ) ) {
			return ApiResponse::validation_error( __( 'This file is not a Gravity Forms or Fluent Forms export.', 'subtleforms' ) );
		}
		$preview = FormMigration::preview( $source, $body['package'] );
		$preview['source'] = $source;
		if ( $preview['error'] !== '' ) {
			return ApiResponse::validation_error( $preview['error'] );
		}
		return ApiResponse::success( $preview );
	}

	/**
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response
	 */
	public function importMigration( WP_REST_Request $request ): WP_REST_Response {
		$body = $this->migrationBody( $request );
		if ( $body instanceof WP_REST_Response ) {
			return $body;
		}
		$source = $body['source'] !== '' ? $body['source'] : FormMigration::detect( $body['package'] );
		if ( ! in_array( $source, array( 'gravity', 'fluent' ), true ) ) {
			return ApiResponse::validation_error( __( 'This file is not a Gravity Forms or Fluent Forms export.', 'subtleforms' ) );
		}
		$result = $this->transfer->importMigrated( $source, $body['package'] );
		if ( $result['error'] !== '' && ! $result['created'] ) {
			return ApiResponse::validation_error( $result['error'] );
		}
		return ApiResponse::success( $result );
	}

	/**
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response
	 */
	public function logs( WP_REST_Request $request ): WP_REST_Response {
		$result = ( new LogsRepository() )->search(
			array(
				'page'     => (int) $request->get_param( 'page' ),
				'per_page' => (int) $request->get_param( 'per_page' ),
				'level'    => (string) $request->get_param( 'level' ),
				'form_id'  => (int) $request->get_param( 'form_id' ),
				'webhook'  => $request->get_param( 'kind' ) === 'webhook',
			)
		);
		return ApiResponse::success( $result );
	}

	/**
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response
	 */
	public function apiLogs( WP_REST_Request $request ): WP_REST_Response {
		$status = $request->get_param( 'status' );
		return ApiResponse::success(
			ApiLog::query(
				array(
					'page'     => (int) $request->get_param( 'page' ),
					'per_page' => (int) $request->get_param( 'per_page' ),
					'status'   => $status,
				)
			)
		);
	}

	/**
	 * @param WP_REST_Request $request Request.
	 * @return array|WP_REST_Response
	 */
	private function migrationBody( WP_REST_Request $request ) {
		$body    = $request->get_json_params();
		$body    = is_array( $body ) ? $body : array();
		$package = $body['package'] ?? $body;
		if ( ! is_array( $package ) ) {
			return ApiResponse::validation_error( __( 'The file could not be read.', 'subtleforms' ) );
		}
		$source = (string) ( $body['source'] ?? '' );
		if ( ! in_array( $source, array( '', 'gravity', 'fluent' ), true ) ) {
			return ApiResponse::validation_error( __( 'Choose Gravity Forms or Fluent Forms.', 'subtleforms' ) );
		}
		return array(
			'source'  => $source,
			'package' => $package,
		);
	}
}
