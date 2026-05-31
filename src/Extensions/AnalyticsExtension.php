<?php


declare(strict_types=1);

namespace SubtleForms\Extensions;

if ( ! defined( 'ABSPATH' ) ) { exit; }

/**
 * Analytics Extension
 *
 * Tracks form views and submission counts in native WordPress options.
 * Exposes a REST endpoint so the dashboard can display stats.
 */
class AnalyticsExtension extends AbstractExtension {

	/** @var string WordPress option key for aggregated view counters. */
	private const VIEWS_OPTION = 'subtleforms_form_views';

	public function slug(): string {
		return 'analytics';
	}

	public function label(): string {
		return 'Analytics';
	}

	public function register(): void {
		if ( ! $this->isEnabled() ) {
			return;
		}

		// Count submissions.
		add_action( 'subtleforms_submission_saved', array( $this, 'countSubmission' ), 10, 2 );

		// Register REST endpoint for stats.
		add_action(
			'rest_api_init',
			function () {
				register_rest_route(
					'subtleforms/v1',
					'/analytics/(?P<form_id>\d+)',
					array(
						'methods'             => 'GET',
						'callback'            => array( $this, 'statsEndpoint' ),
						'permission_callback' => function () {
							return current_user_can( 'edit_posts' );
						},
						'args'                => array(
							'form_id' => array(
								'type'              => 'integer',
								'required'          => true,
								'sanitize_callback' => 'absint',
							),
						),
					)
				);
			}
		);

		if ( (bool) $this->getSetting( 'view_tracking' ) ) {
			add_action( 'subtleforms_form_viewed', array( $this, 'countView' ), 10, 1 );
		}
	}

	/**
	 * Increment the view counter for a form.
	 *
	 * @param int $form_id Form ID.
	 */
	public function countView( int $form_id ): void {
		$views             = (array) get_option( self::VIEWS_OPTION, array() );
		$views[ $form_id ] = ( $views[ $form_id ] ?? 0 ) + 1;
		update_option( self::VIEWS_OPTION, $views, false );
	}

	/**
	 * Increment the submission counter for a form.
	 *
	 * @param int   $form_id    Form ID.
	 * @param array $submission Submission data.
	 */
	public function countSubmission( int $form_id, array $submission ): void {
		$key = 'subtleforms_submissions_count_' . $form_id;
		$val = (int) get_option( $key, 0 );
		update_option( $key, $val + 1, false );
	}

	/**
	 * REST callback: return view + submission counts.
	 *
	 * @param \WP_REST_Request $request
	 */
	public function statsEndpoint( \WP_REST_Request $request ): \WP_REST_Response {
		$form_id     = (int) $request->get_param( 'form_id' );
		$views       = (array) get_option( self::VIEWS_OPTION, array() );
		$sub_count   = (int) get_option( 'subtleforms_submissions_count_' . $form_id, 0 );

		return new \WP_REST_Response(
			array(
				'form_id'     => $form_id,
				'views'       => $views[ $form_id ] ?? 0,
				'submissions' => $sub_count,
			),
			200
		);
	}
}
