<?php

namespace SubtleForms\Api;

use SubtleForms\Repositories\FormsRepository;
use SubtleForms\Repositories\SubmissionsRepository;
use SubtleForms\Support\Settings;
use WP_REST_Request;
use WP_REST_Response;
use WP_Error;

/**
 * Dashboard API
 * 
 * REST API endpoint for dashboard statistics and activity.
 */
class DashboardApi
{
    /**
     * @var FormsRepository
     */
    private $formsRepo;

    /**
     * @var SubmissionsRepository
     */
    private $submissionsRepo;

    /**
     * @var Settings
     */
    private $settings;

    /**
     * Constructor
     * 
     * @param FormsRepository $formsRepo Forms repository
     * @param SubmissionsRepository $submissionsRepo Submissions repository
     * @param Settings $settings Settings manager
     */
    public function __construct(
        FormsRepository $formsRepo,
        SubmissionsRepository $submissionsRepo,
        ?Settings $settings = null
    ) {
        $this->formsRepo = $formsRepo;
        $this->submissionsRepo = $submissionsRepo;
        $this->settings = $settings;
    }

    /**
     * Register routes
     */
    public function registerRoutes()
    {
        register_rest_route('subtleforms/v1', '/dashboard', [
            'methods' => 'GET',
            'callback' => [$this, 'getDashboard'],
            'permission_callback' => [$this, 'checkPermissions'],
        ]);
    }

    /**
     * Get dashboard data
     * 
     * @param WP_REST_Request $request
     * @return WP_REST_Response|WP_Error
     */
    public function getDashboard(WP_REST_Request $request)
    {
        try {
            $data = [
                'stats' => $this->getStats(),
                'recent_submissions' => $this->getRecentSubmissions(),
                'recent_forms' => $this->getRecentForms(),
                'system_health' => $this->getSystemHealth(),
            ];

            return new WP_REST_Response([
                'success' => true,
                'data' => $data,
            ], 200);
        } catch (\Exception $e) {
            return new WP_Error(
                'dashboard_error',
                $e->getMessage(),
                ['status' => 500]
            );
        }
    }

    /**
     * Get dashboard statistics
     * 
     * @return array
     */
    private function getStats()
    {
        global $wpdb;
        $formsTable = $wpdb->prefix . 'subtleforms_forms';
        $submissionsTable = $wpdb->prefix . 'subtleforms_submissions';

        // Get form counts
        $totalForms = $this->formsRepo->count();
        $publishedForms = $this->formsRepo->count(['status' => 'published']);
        $draftForms = $this->formsRepo->count(['status' => 'draft']);

        // Get submission counts
        $totalSubmissions = $this->submissionsRepo->count();

        // Submissions today
        $todayStart = gmdate('Y-m-d 00:00:00');
        $submissionsToday = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$submissionsTable} WHERE created_at >= %s",
            $todayStart
        ));

        // Submissions this week (last 7 days)
        $weekStart = gmdate('Y-m-d 00:00:00', strtotime('-7 days'));
        $submissionsThisWeek = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$submissionsTable} WHERE created_at >= %s",
            $weekStart
        ));

        // Average submissions per form
        $avgSubmissionsPerForm = $publishedForms > 0 
            ? round($totalSubmissions / $publishedForms, 1) 
            : 0;

        return [
            'total_forms' => $totalForms,
            'published_forms' => $publishedForms,
            'draft_forms' => $draftForms,
            'total_submissions' => $totalSubmissions,
            'submissions_today' => $submissionsToday,
            'submissions_this_week' => $submissionsThisWeek,
            'avg_submissions_per_form' => $avgSubmissionsPerForm,
        ];
    }

    /**
     * Get recent submissions
     * 
     * @return array
     */
    private function getRecentSubmissions()
    {
        global $wpdb;
        $submissionsTable = $wpdb->prefix . 'subtleforms_submissions';
        $formsTable = $wpdb->prefix . 'subtleforms_forms';

        $results = $wpdb->get_results($wpdb->prepare(
            "SELECT s.id, s.form_id, s.status, s.created_at, f.title as form_title
             FROM {$submissionsTable} s
             LEFT JOIN {$formsTable} f ON s.form_id = f.id
             ORDER BY s.created_at DESC
             LIMIT %d",
            10
        ), ARRAY_A);

        return array_map(function($row) {
            return [
                'id' => (int) $row['id'],
                'form_id' => (int) $row['form_id'],
                'form_title' => $row['form_title'] ?? 'Unknown Form',
                'status' => $row['status'],
                'created_at' => $row['created_at'],
                'time_ago' => $this->timeAgo($row['created_at']),
            ];
        }, $results);
    }

    /**
     * Get recently edited forms
     * 
     * @return array
     */
    private function getRecentForms()
    {
        $forms = $this->formsRepo->all([
            'limit' => 10,
            'orderby' => 'updated_at',
            'order' => 'DESC',
        ]);

        return array_map(function($form) {
            // Get submission count for this form
            $submissionCount = $this->submissionsRepo->count(['form_id' => $form['id']]);

            return [
                'id' => $form['id'],
                'title' => $form['title'],
                'status' => $form['status'],
                'updated_at' => $form['updated_at'],
                'time_ago' => $this->timeAgo($form['updated_at']),
                'submission_count' => $submissionCount,
            ];
        }, $forms);
    }

    /**
     * Get system health information
     * 
     * @return array
     */
    private function getSystemHealth()
    {
        global $wpdb;

        $health = [
            'plugin_version' => defined('SUBTLEFORMS_VERSION') ? SUBTLEFORMS_VERSION : '1.0.0',
            'wordpress_version' => get_bloginfo('version'),
            'php_version' => PHP_VERSION,
            'database_version' => $wpdb->db_version(),
            'debug_mode' => $this->settings ? $this->settings->get('debug_mode', false) : false,
            'autosave_enabled' => $this->settings ? $this->settings->get('autosave_enabled', true) : true,
            'memory_limit' => ini_get('memory_limit'),
            'max_upload_size' => size_format(wp_max_upload_size()),
        ];

        // Check if database tables exist
        $formsTable = $wpdb->prefix . 'subtleforms_forms';
        $submissionsTable = $wpdb->prefix . 'subtleforms_submissions';

        $health['tables_exist'] = [
            'forms' => $wpdb->get_var("SHOW TABLES LIKE '{$formsTable}'") === $formsTable,
            'submissions' => $wpdb->get_var("SHOW TABLES LIKE '{$submissionsTable}'") === $submissionsTable,
        ];

        // Overall health status
        $allTablesExist = $health['tables_exist']['forms'] && $health['tables_exist']['submissions'];
        $phpVersionOk = version_compare(PHP_VERSION, '7.4', '>=');
        
        $health['status'] = ($allTablesExist && $phpVersionOk) ? 'healthy' : 'warning';

        return $health;
    }

    /**
     * Convert timestamp to human-readable time ago
     * 
     * @param string $datetime MySQL datetime string
     * @return string
     */
    private function timeAgo($datetime)
    {
        $timestamp = strtotime($datetime);
        $diff = time() - $timestamp;

        if ($diff < 60) {
            return $diff . ' seconds ago';
        } elseif ($diff < 3600) {
            $minutes = floor($diff / 60);
            return $minutes . ' minute' . ($minutes > 1 ? 's' : '') . ' ago';
        } elseif ($diff < 86400) {
            $hours = floor($diff / 3600);
            return $hours . ' hour' . ($hours > 1 ? 's' : '') . ' ago';
        } elseif ($diff < 604800) {
            $days = floor($diff / 86400);
            return $days . ' day' . ($days > 1 ? 's' : '') . ' ago';
        } else {
            return gmdate('M j, Y', $timestamp);
        }
    }

    /**
     * Check permissions
     * 
     * @return bool
     */
    public function checkPermissions()
    {
        return current_user_can('manage_options');
    }
}
