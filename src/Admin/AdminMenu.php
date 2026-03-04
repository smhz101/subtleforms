<?php
/**
 * SubtleForms Admin Menu
 *
 * @package   SubtleForms\Admin
 * @version   0.1.0
 */

namespace SubtleForms\Admin;

use SubtleForms\Support\Capabilities;
use SubtleForms\Support\Helpers;
use SubtleForms\Repositories\FormsRepository;
use SubtleForms\Repositories\SubmissionsRepository;

/**
 * Admin menu and interface management.
 */
class AdminMenu {

	/**
	 * @var Capabilities
	 */
	private $caps;

	/**
	 * @var FormsRepository
	 */
	private $formsRepo;

	/**
	 * @var SubmissionsRepository
	 */
	private $submissionsRepo;

	/**
	 * @var string
	 */
	private $currentPage = '';

	public function __construct(
		Capabilities $caps,
		?FormsRepository $formsRepo = null,
		?SubmissionsRepository $submissionsRepo = null
	) {
		$this->caps            = $caps;
		$this->formsRepo       = $formsRepo ?? new FormsRepository();
		$this->submissionsRepo = $submissionsRepo ?? new SubmissionsRepository();

		add_action( 'admin_menu', array( $this, 'register_menu' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_assets' ) );
		add_action( 'admin_init', array( $this, 'handle_actions' ) );
		add_filter( 'admin_body_class', array( $this, 'filter_admin_body_class' ) );
		// Hook title filter with highest priority to catch null values first
		add_filter( 'admin_title', array( $this, 'filter_admin_title' ), 1, 2 );
		// Fix globals early before WordPress uses them
		add_action( 'admin_init', array( $this, 'fix_admin_globals' ), 1 );
		// Fix menu highlighting for correct active states
		add_filter( 'parent_file', array( $this, 'fix_parent_file' ) );
		add_filter( 'submenu_file', array( $this, 'fix_submenu_file' ) );

		add_action(
			'admin_menu',
			function () {
				global $submenu;

				if ( isset( $submenu['subtleforms'][0] ) ) {
					$submenu['subtleforms'][0][0] = __( 'Dashboard', 'subtleforms' );
				}
			},
			100
		);
	}

	/**
	 * Get submission menu title with unread count badge.
	 */
	private function getSubmissionMenuTitle(): string {
		$baseTitle = esc_html__( 'Submissions', 'subtleforms' );

		try {
			$unreadCount = $this->submissionsRepo->count( array( 'status' => 'unread' ) );

			if ( $unreadCount > 0 ) {
				$badge = sprintf( '<span class="awaiting-mod count-%d"><span class="pending-count">%d</span></span>', $unreadCount, $unreadCount );
				return $baseTitle . ' ' . $badge;
			}
		} catch ( \Exception $e ) {
			// Silently fail if there's an issue getting the count
		}

		return $baseTitle;
	}

	/**
	 * Register admin menu pages.
	 */
	public function register_menu() {
		// Main menu page - Dashboard
		add_menu_page(
			__( 'Subtle Forms', 'subtleforms' ),
			__( 'Subtle Forms', 'subtleforms' ),
			$this->caps->manage_cap(),
			'subtleforms',
			array( $this, 'render_dashboard' ),
			'dashicons-feedback',
			56
		);

		// Dashboard submenu (rename the first item)
		// add_submenu_page(
		// 'subtleforms',
		// __('Dashboard', 'subtleforms'),
		// __('Dashboard', 'subtleforms'),
		// $this->caps->manage_cap(),
		// 'subtleforms',
		// [$this, 'render_dashboard']
		// );

		// All Forms
		add_submenu_page(
			'subtleforms',
			__( 'All Forms', 'subtleforms' ),
			__( 'All Forms', 'subtleforms' ),
			$this->caps->manage_cap(),
			'subtleforms-forms',
			array( $this, 'render_forms' )
		);

		// Add New Form
		add_submenu_page(
			'subtleforms',
			__( 'Add New Form', 'subtleforms' ),
			__( 'Add New', 'subtleforms' ),
			$this->caps->manage_cap(),
			'subtleforms-new-form',
			array( $this, 'render_new_form' )
		);

		// Submissions with count badge
		$submissionMenuTitle = $this->getSubmissionMenuTitle();
		add_submenu_page(
			'subtleforms',
			__( 'Submissions', 'subtleforms' ),
			$submissionMenuTitle,
			$this->caps->manage_cap(),
			'subtleforms-submissions',
			array( $this, 'render_submissions' )
		);

		// Extensions
		add_submenu_page(
			'subtleforms',
			__( 'Extensions', 'subtleforms' ),
			__( 'Extensions', 'subtleforms' ),
			$this->caps->manage_cap(),
			'subtleforms-extensions',
			array( $this, 'render_extensions' )
		);

		// Settings
		add_submenu_page(
			'subtleforms',
			__( 'Settings', 'subtleforms' ),
			__( 'Settings', 'subtleforms' ),
			$this->caps->manage_cap(),
			'subtleforms-settings',
			array( $this, 'render_settings' )
		);

		// Allow extensions to add their own pages
		do_action( 'subtleforms/admin_menu', $this->caps );
	}

	/**
	 * Enqueue admin assets.
	 */
	public function enqueue_assets( string $hook ): void {
		// Ensure $hook is never null
		$hook = Helpers::normalize_string( $hook );

		// Only load on our admin pages
		if ( strpos( $hook, 'subtleforms' ) === false ) {
			return;
		}

		$this->currentPage = $hook;

		// Load Google Fonts for design system
		wp_enqueue_style(
			'subtleforms-fonts',
			'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600;700&family=IBM+Plex+Serif:wght@400;600;700&family=Inter:wght@400;500;600;700&display=swap',
			array(),
			null
		);

		// Main admin CSS
		wp_enqueue_style(
			'subtleforms-admin',
			SUBTLEFORMS_PLUGIN_URL . 'assets/css/admin.css',
			array(),
			SUBTLEFORMS_VERSION
		);

		// Component styles from wp-scripts build (Settings, Dashboard, etc.)
		wp_enqueue_style(
			'subtleforms-components',
			SUBTLEFORMS_PLUGIN_URL . 'build/admin/index.jsx.css',
			array( 'subtleforms-admin' ),
			SUBTLEFORMS_VERSION
		);

		if ( $this->is_builder_screen( $hook ) ) {
			wp_enqueue_style(
				'subtleforms-admin-builder',
				SUBTLEFORMS_PLUGIN_URL . 'assets/css/admin-builder.css',
				array( 'subtleforms-admin' ),
				SUBTLEFORMS_VERSION
			);
		}

		// Main admin JS (built bundle at build/admin/admin.js)
		$asset_file = SUBTLEFORMS_PLUGIN_DIR . 'build/admin/admin.asset.php';
		if ( file_exists( $asset_file ) ) {
			$asset = include $asset_file;
			wp_enqueue_script(
				'subtleforms-admin',
				SUBTLEFORMS_PLUGIN_URL . 'build/admin/admin.js',
				$asset['dependencies'] ?? array( 'wp-element', 'wp-components', 'wp-data', 'wp-i18n' ),
				$asset['version'] ?? SUBTLEFORMS_VERSION,
				true
			);
		} else {
			wp_enqueue_script(
				'subtleforms-admin',
				SUBTLEFORMS_PLUGIN_URL . 'build/admin/admin.js',
				array( 'wp-element', 'wp-components', 'wp-data', 'wp-i18n' ),
				SUBTLEFORMS_VERSION,
				true
			);
		}

		// Expose build URL so webpack async chunks (code-split pages) load correctly.
		// This must run BEFORE the admin script executes.
		wp_add_inline_script(
			'subtleforms-admin',
			sprintf(
				'window.__subtleformsPublicPath = %s;',
				wp_json_encode( SUBTLEFORMS_PLUGIN_URL . 'build/admin/' )
			),
			'before'
		);

		// Get license data if Pro is active (no API calls, just read from options)
		$license_data = array();
		if ( defined( 'SUBTLEFORMS_PRO_VERSION' ) && function_exists( 'subtleforms_pro' ) ) {
			$license_manager = subtleforms_pro()->get_license_manager();
			$license_status  = $license_manager->get_license_status();
			$raw_license_data = $license_manager->get_license_data();
			
			$license_data = array(
				'status'     => $license_status, // active, inactive, expired, grace
				'plan'       => ! empty( $raw_license_data['plan'] ) ? $raw_license_data['plan'] : 'pro',
				'expiresAt'  => ! empty( $raw_license_data['expires'] ) ? $raw_license_data['expires'] : null,
			);
		}

		// Localize script with data
		wp_localize_script(
			'subtleforms-admin',
			'subtleformsAdmin',
			array(
				'ajaxUrl'       => admin_url( 'admin-ajax.php' ),
				'restUrl'       => rest_url( 'subtleforms/v1' ),
				'nonce'         => wp_create_nonce( 'subtleforms_admin' ),
				'restNonce'     => wp_create_nonce( 'wp_rest' ),
				'capabilities'  => $this->caps->all(),
				'hasProPlugin'  => defined( 'SUBTLEFORMS_PRO_VERSION' ),
				'license'       => $license_data, // License info from Pro plugin (no API calls)
				'i18n'          => array(
					'confirmDelete' => __( 'Are you sure you want to delete this item?', 'subtleforms' ),
					'error'         => __( 'An error occurred. Please try again.', 'subtleforms' ),
					'success'       => __( 'Action completed successfully.', 'subtleforms' ),
				),
			)
		);

		// Additional data for Settings page
		wp_localize_script(
			'subtleforms-admin',
			'subtleformsData',
			array(
				'siteName'   => get_option( 'blogname' ),
				'adminEmail' => get_option( 'admin_email' ),
			)
		);

		// Allow extensions to enqueue their assets
		do_action( 'subtleforms/admin_enqueue_scripts', $hook );
	}

	private function is_builder_screen( string $hook ): bool {
		$hook = Helpers::normalize_string( $hook );
		if ( strpos( $hook, 'subtleforms-new-form' ) !== false ) {
			return true;
		}

		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only check for admin screen routing.
		$page = isset( $_GET['page'] ) ? sanitize_key( wp_unslash( $_GET['page'] ) ) : '';

		return $page === 'subtleforms-new-form';
	}

	public function filter_admin_body_class( $classes ) {
		// Handle different input types (string or array)
		if ( is_array( $classes ) ) {
			$classes = implode( ' ', $classes );
		} elseif ( ! is_string( $classes ) || $classes === null ) {
			$classes = '';
		}

		// Ensure $classes is never null
		$classes = (string) $classes;

		if ( $this->is_builder_screen( $this->currentPage ?: '' ) ) {
			$classes .= ' subtleforms-builder-page';
		}

		$page = isset( $_GET['page'] ) ? sanitize_key( Helpers::normalize_string( $_GET['page'] ) ) : '';
		if ( $page === 'subtleforms-new-form' && strpos( Helpers::normalize_string( $classes ), 'subtleforms-builder-page' ) === false ) {
			$classes .= ' subtleforms-builder-page';
		}

		return trim( $classes );
	}

	/**
	 * Handle admin actions (delete, duplicate, etc.).
	 */
	public function handle_actions(): void {
		if ( ! isset( $_GET['action'] ) ) {
			return;
		}

		$action = sanitize_key( Helpers::safe_string_get( $_GET, 'action' ) );

		// Only handle SubtleForms-specific admin actions here.
		$allowed = array(
			'delete_form',
			'duplicate_form',
			'delete_submission',
		);

		if ( ! in_array( $action, $allowed, true ) ) {
			return;
		}

		// For our actions, require nonce and validate it.
		// phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- Nonce is validated, not sanitized.
		if ( empty( $_GET['_wpnonce'] ) || ! wp_verify_nonce( wp_unslash( $_GET['_wpnonce'] ), 'subtleforms_action' ) ) {
			wp_die( __( 'Security check failed.', 'subtleforms' ) );
		}

		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Nonce verified above.
		$id = isset( $_GET['id'] ) ? intval( $_GET['id'] ) : 0;

		switch ( $action ) {
			case 'delete_form':
				$this->handle_delete_form( $id );
				break;
			case 'duplicate_form':
				$this->handle_duplicate_form( $id );
				break;
			case 'delete_submission':
				$this->handle_delete_submission( $id );
				break;
		}
	}

	/**
	 * Render dashboard page.
	 */
	public function render_dashboard(): void {
		if ( ! current_user_can( $this->caps->manage_cap() ) ) {
			wp_die( __( 'You do not have permission to access this page.', 'subtleforms' ) );
		}

		$stats = $this->get_dashboard_stats();

		$this->get_template( 'dashboard', $stats );
	}

	/**
	 * Render forms list page.
	 */
	public function render_forms(): void {
		if ( ! current_user_can( $this->caps->manage_cap() ) ) {
			wp_die( __( 'You do not have permission to access this page.', 'subtleforms' ) );
		}

		$forms = $this->formsRepo->all(
			array(
				'limit'   => 50,
				'orderby' => 'updated_at',
				'order'   => 'DESC',
			)
		);

		$this->get_template( 'forms-list', array( 'forms' => $forms ) );
	}

	/**
	 * Render new form page.
	 */
	public function render_new_form(): void {
		if ( ! current_user_can( $this->caps->manage_cap() ) ) {
			wp_die( __( 'You do not have permission to access this page.', 'subtleforms' ) );
		}

		// Check if editing an existing form
		$formId = isset( $_GET['form_id'] ) ? intval( $_GET['form_id'] ) : null;
		$form   = null;

		if ( $formId ) {
			$form = $this->formsRepo->find( $formId );
			if ( ! $form ) {
				wp_die( __( 'Form not found.', 'subtleforms' ) );
			}
		}

		$this->get_template( 'form-editor', array( 'form' => $form ) );
	}

	/**
	 * Render submissions page.
	 */
	public function render_submissions(): void {
		if ( ! current_user_can( $this->caps->manage_cap() ) ) {
			wp_die( __( 'You do not have permission to access this page.', 'subtleforms' ) );
		}

		$formId      = isset( $_GET['form_id'] ) ? intval( $_GET['form_id'] ) : null;
		$submissions = $formId
			? $this->submissionsRepo->findByForm( $formId, array( 'limit' => 50 ) )
			: array();

		$forms = $this->formsRepo->all( array( 'limit' => 100 ) );

		$this->get_template(
			'submissions-list',
			array(
				'submissions'   => $submissions,
				'forms'         => $forms,
				'currentFormId' => $formId,
			)
		);
	}

	/**
	 * Render extensions page.
	 */
	public function render_extensions(): void {
		if ( ! current_user_can( $this->caps->manage_cap() ) ) {
			wp_die( __( 'You do not have permission to access this page.', 'subtleforms' ) );
		}

		$this->get_template( 'extensions' );
	}

	/**
	 * Render settings page.
	 */
	public function render_settings(): void {
		if ( ! current_user_can( $this->caps->manage_cap() ) ) {
			wp_die( __( 'You do not have permission to access this page.', 'subtleforms' ) );
		}

		$this->get_template( 'settings' );
	}

	/**
	 * Get dashboard statistics.
	 */
	private function get_dashboard_stats(): array {
		return array(
			'total_forms'        => $this->formsRepo->count(),
			'active_forms'       => $this->formsRepo->count( array( 'status' => 'published' ) ),
			'draft_forms'        => $this->formsRepo->count( array( 'status' => 'draft' ) ),
			'total_submissions'  => $this->submissionsRepo->count(),
			'recent_submissions' => $this->submissionsRepo->count(
				array(
					'status' => 'completed',
				)
			),
		);
	}

	/**
	 * Handle form deletion.
	 */
	private function handle_delete_form( int $id ): void {
		if ( ! $id || ! current_user_can( $this->caps->manage_cap() ) ) {
			wp_die( __( 'Invalid request.', 'subtleforms' ) );
		}

		$this->formsRepo->delete( $id );

		wp_redirect(
			add_query_arg(
				array(
					'page'    => 'subtleforms-forms',
					'message' => 'deleted',
				),
				admin_url( 'admin.php' )
			)
		);
		exit;
	}

	/**
	 * Handle form duplication.
	 */
	private function handle_duplicate_form( int $id ): void {
		if ( ! $id || ! current_user_can( $this->caps->manage_cap() ) ) {
			wp_die( __( 'Invalid request.', 'subtleforms' ) );
		}

		$form = $this->formsRepo->find( $id );
		if ( ! $form ) {
			wp_die( __( 'Form not found.', 'subtleforms' ) );
		}

		$newId = $this->formsRepo->create(
			array(
				'title'  => $form['title'] . ' (Copy)',
				'config' => $form['config'],
				'status' => 'draft',
			)
		);

		wp_redirect(
			add_query_arg(
				array(
					'page'    => 'subtleforms-forms',
					'message' => 'duplicated',
				),
				admin_url( 'admin.php' )
			)
		);
		exit;
	}

	/**
	 * Handle submission deletion.
	 */
	private function handle_delete_submission( int $id ): void {
		if ( ! $id || ! current_user_can( $this->caps->manage_cap() ) ) {
			wp_die( __( 'Invalid request.', 'subtleforms' ) );
		}

		$this->submissionsRepo->delete( $id );

		wp_redirect(
			add_query_arg(
				array(
					'page'    => 'subtleforms-submissions',
					'message' => 'deleted',
				),
				admin_url( 'admin.php' )
			)
		);
		exit;
	}

	/**
	 * Get template file path or render inline fallback.
	 */
	private function get_template( string $name, array $data = array() ): void {
		$templatePath = SUBTLEFORMS_PLUGIN_DIR . 'templates/admin/' . $name . '.php';

		if ( file_exists( $templatePath ) ) {
			// $data is available to the template via the local scope.
			include $templatePath;
			return;
		}

		// Inline fallback template
		$this->render_fallback_template( $name, $data );
	}

	/**
	 * Render inline fallback template when file doesn't exist.
	 */
	private function render_fallback_template( string $name, array $data ): void {
		?>
		<div class="wrap subtleforms-admin">
			<h1><?php echo Helpers::safe_esc_html( ucwords( str_replace( '-', ' ', $name ) ) ); ?></h1>
			
			<?php if ( isset( $_GET['message'] ) ) : ?>
				<div class="notice notice-success is-dismissible">
					<p><?php esc_html_e( 'Action completed successfully.', 'subtleforms' ); ?></p>
				</div>
			<?php endif; ?>

			<div class="subtleforms-placeholder">
				<div class="subtleforms-placeholder-icon">
					<span class="dashicons dashicons-feedback"></span>
				</div>
				<h2><?php esc_html_e( 'Coming Soon', 'subtleforms' ); ?></h2>
				<p>
					<?php
					/* translators: %s: Name of the interface being developed */
					printf( esc_html__( 'The %s interface is under development.', 'subtleforms' ), '<strong>' . Helpers::safe_esc_html( $name ) . '</strong>' );
					?>
				</p>
				<p class="description">
					<?php esc_html_e( 'This is a placeholder. Template files will be created in the templates/admin/ directory.', 'subtleforms' ); ?>
				</p>
				
				<?php if ( $name === 'forms-list' && ! empty( $data['forms'] ) ) : ?>
					<div class="subtleforms-quick-list">
						<h3><?php esc_html_e( 'Your Forms', 'subtleforms' ); ?></h3>
						<table class="widefat">
							<thead>
								<tr>
										<th><?php esc_html_e( 'Title', 'subtleforms' ); ?></th>
										<th><?php esc_html_e( 'Status', 'subtleforms' ); ?></th>
										<th><?php esc_html_e( 'Created', 'subtleforms' ); ?></th>
										<th><?php esc_html_e( 'Actions', 'subtleforms' ); ?></th>
								</tr>
							</thead>
							<tbody>
								<?php foreach ( $data['forms'] as $form ) : ?>
									<tr>
										<td><strong><?php echo Helpers::safe_esc_html( Helpers::safe_array_get( $form, 'title' ) ); ?></strong></td>
										<td><?php echo Helpers::safe_esc_html( Helpers::safe_array_get( $form, 'status' ) ); ?></td>
										<td><?php echo Helpers::safe_esc_html( Helpers::safe_array_get( $form, 'created_at' ) ); ?></td>
										<td>
											<a href="
											<?php
											echo Helpers::safe_esc_url(
												wp_nonce_url(
													add_query_arg(
														array(
															'action' => 'delete_form',
															'id' => Helpers::safe_array_get( $form, 'id', 0 ),
														),
														admin_url( 'admin.php' )
													),
													'subtleforms_action'
												)
											);
											?>
														" class="button button-small"><?php esc_html_e( 'Delete', 'subtleforms' ); ?></a>
										</td>
									</tr>
								<?php endforeach; ?>
							</tbody>
						</table>
					</div>
				<?php endif; ?>

				<?php if ( $name === 'dashboard' && isset( $data['total_forms'] ) ) : ?>
					<div class="subtleforms-stats" style="margin-top: 30px;">
						<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; max-width: 800px; margin: 0 auto;">
							<div class="subtleforms-stat-card" style="background: #fff; padding: 20px; border: 1px solid #ccc; border-radius: 4px;">
								<h3 style="margin: 0 0 10px;"><?php echo Helpers::safe_esc_html( Helpers::safe_array_get( $data, 'total_forms', 0 ) ); ?></h3>
								<p style="margin: 0; color: #666;"><?php esc_html_e( 'Total Forms', 'subtleforms' ); ?></p>
							</div>
							<div class="subtleforms-stat-card" style="background: #fff; padding: 20px; border: 1px solid #ccc; border-radius: 4px;">
								<h3 style="margin: 0 0 10px;"><?php echo Helpers::safe_esc_html( Helpers::safe_array_get( $data, 'active_forms', 0 ) ); ?></h3>
								<p style="margin: 0; color: #666;"><?php esc_html_e( 'Active Forms', 'subtleforms' ); ?></p>
							</div>
							<div class="subtleforms-stat-card" style="background: #fff; padding: 20px; border: 1px solid #ccc; border-radius: 4px;">
								<h3 style="margin: 0 0 10px;"><?php echo Helpers::safe_esc_html( Helpers::safe_array_get( $data, 'total_submissions', 0 ) ); ?></h3>
								<p style="margin: 0; color: #666;"><?php esc_html_e( 'Total Submissions', 'subtleforms' ); ?></p>
							</div>
						</div>
					</div>
				<?php endif; ?>
			</div>
		</div>

		<style>
			.subtleforms-placeholder {
				text-align: center;
				padding: 60px 20px;
				max-width: 800px;
				margin: 0 auto;
			}
			.subtleforms-placeholder-icon {
				font-size: 64px;
				color: #ddd;
				margin-bottom: 20px;
			}
			.subtleforms-placeholder h2 {
				font-size: 24px;
				margin-bottom: 10px;
			}
			.subtleforms-quick-list {
				margin-top: 40px;
				text-align: left;
			}
		</style>
		<?php
		exit;
	}

	/**
	 * Filter admin title to ensure proper titles for SubtleForms pages.
	 */
	public function filter_admin_title( $admin_title, $title ): string {
		// Ensure both parameters are strings to prevent deprecation warnings
		$admin_title = Helpers::normalize_string( $admin_title );
		$title       = Helpers::normalize_string( $title );

		// If both are empty, provide a fallback for SubtleForms pages
		if ( empty( $title ) && empty( $admin_title ) ) {
			$current_screen = get_current_screen();
			if ( $current_screen && isset( $current_screen->id ) ) {
				$screen_id = Helpers::normalize_string( $current_screen->id );
				if ( ! empty( $screen_id ) && strpos( $screen_id, 'subtleforms' ) !== false ) {
					return __( 'Subtle Forms', 'subtleforms' ) . ' &#8212; WordPress';
				}
			}
			return __( 'WordPress Admin', 'subtleforms' );
		}

		// Return admin_title if title is empty, otherwise return admin_title (or fallback)
		if ( empty( $title ) ) {
			return ! empty( $admin_title ) ? $admin_title : __( 'WordPress Admin', 'subtleforms' );
		}

		return ! empty( $admin_title ) ? $admin_title : $title;
	}

	/**
	 * Fix admin global variables to prevent null deprecation warnings.
	 */
	public function fix_admin_globals(): void {
		global $title, $parent_file, $submenu_file;

		// Ensure $title is never null using Helpers
		if ( $title === null || $title === '' ) {
			$current_screen = get_current_screen();
			if ( $current_screen && isset( $current_screen->id ) ) {
				$screen_id = Helpers::normalize_string( $current_screen->id );
				if ( ! empty( $screen_id ) && strpos( $screen_id, 'subtleforms' ) !== false ) {
					$title = __( 'Subtle Forms', 'subtleforms' );
				} else {
					$title = '';
				}
			} else {
				$title = '';
			}
		} else {
			// Always ensure $title is a string
			$title = Helpers::normalize_string( $title );
		}

		// Ensure other globals are strings
		if ( $parent_file === null ) {
			$parent_file = '';
		} else {
			$parent_file = Helpers::normalize_string( $parent_file );
		}

		if ( $submenu_file === null ) {
			$submenu_file = '';
		} else {
			$submenu_file = Helpers::normalize_string( $submenu_file );
		}
	}

	/**
	 * Fix parent_file to ensure correct top-level menu highlighting.
	 * 
	 * WordPress needs parent_file to match the top-level menu slug
	 * for all SubtleForms admin pages.
	 *
	 * @param string $parent_file The current parent file.
	 * @return string The corrected parent file.
	 */
	public function fix_parent_file( $parent_file ) {
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only check for admin screen routing.
		$page = isset( $_GET['page'] ) ? sanitize_key( wp_unslash( $_GET['page'] ) ) : '';

		// For all SubtleForms pages, ensure parent is 'subtleforms'
		if ( ! empty( $page ) && strpos( $page, 'subtleforms' ) === 0 ) {
			return 'subtleforms';
		}

		return $parent_file;
	}

	/**
	 * Fix submenu_file to ensure correct submenu highlighting.
	 * 
	 * This tells WordPress which submenu item should be highlighted as active.
	 * The dashboard page uses 'subtleforms' (same as parent), which WordPress
	 * auto-converts to the first submenu item.
	 *
	 * @param string $submenu_file The current submenu file.
	 * @return string The corrected submenu file.
	 */
	public function fix_submenu_file( $submenu_file ) {
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only check for admin screen routing.
		$page = isset( $_GET['page'] ) ? sanitize_key( wp_unslash( $_GET['page'] ) ) : '';

		if ( empty( $page ) ) {
			return $submenu_file;
		}

		// Map each page to its correct submenu slug
		// Dashboard uses the parent slug, which WordPress highlights as first submenu
		if ( $page === 'subtleforms' ) {
			return 'subtleforms';
		}

		// All other pages should highlight themselves
		if ( strpos( $page, 'subtleforms' ) === 0 ) {
			return $page;
		}

		return $submenu_file;
	}
}
