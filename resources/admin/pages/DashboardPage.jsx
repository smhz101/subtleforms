import { useState, useEffect } from '@wordpress/element';
import {
  Card,
  CardBody,
  CardHeader,
  Spinner,
  Notice,
  Button,
} from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import apiFetch from '@wordpress/api-fetch';
import clsx from 'clsx';
import {
  FiFileText,
  FiLayers,
  FiList,
  FiMessageCircle,
  FiCreditCard,
  FiDatabase,
  FiCalendar,
  FiTrendingUp,
  FiCheckCircle,
  FiAlertCircle,
} from 'react-icons/fi';
import AdminShell from '../components/AdminShell';
import './DashboardPage.css';

/**
 * Dashboard Page Component
 */
export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiFetch({
        path: '/subtleforms/v1/dashboard',
        method: 'GET',
      });

      if (response.success) {
        setData(response.data);
      }
    } catch (err) {
      console.error('Failed to load dashboard:', err);
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className='subtleforms-dashboard-loading'>
        <Spinner />
        <p>{__('Loading dashboard...', 'subtleforms')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className='subtleforms-dashboard-error'>
        <Notice status='error' isDismissible={false}>
          {error}
        </Notice>
        <Button variant='primary' onClick={loadDashboard}>
          {__('Retry', 'subtleforms')}
        </Button>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const { stats, recent_submissions, recent_forms, system_health } = data;

  return (
    <AdminShell
      title={__('Dashboard', 'subtleforms')}
      actions={
        <div className='sf-flex sf-gap-2'>
          <Button variant='secondary' href='admin.php?page=subtleforms-forms'>
            {__('All Forms', 'subtleforms')}
          </Button>
          <Button
            variant='secondary'
            href='admin.php?page=subtleforms-submissions'>
            {__('All Submissions', 'subtleforms')}
          </Button>
          <Button
            variant='secondary'
            href='admin.php?page=subtleforms-settings'>
            {__('Settings', 'subtleforms')}
          </Button>
        </div>
      }>
      <div className='sf-p-6'>
        {/* Stats Overview */}
        <div className='sf-gap-4 sf-grid sf-grid-cols-1 md:sf-grid-cols-2 lg:sf-grid-cols-4 sf-mb-6'>
          <StatCard
            title={__('Total Forms', 'subtleforms')}
            value={stats.total_forms}
            subtitle={`${stats.published_forms} published, ${stats.draft_forms} draft`}
            icon={<FiFileText className='sf-w-6 sf-h-6 sf-text-blue-600' />}
            link='admin.php?page=subtleforms-forms'
          />
          <StatCard
            title={__('Total Submissions', 'subtleforms')}
            value={stats.total_submissions}
            subtitle={
              stats.published_forms > 0
                ? `${stats.avg_submissions_per_form} avg per form`
                : __('No published forms', 'subtleforms')
            }
            icon={<FiDatabase className='sf-w-6 sf-h-6 sf-text-green-600' />}
            link='admin.php?page=subtleforms-submissions'
          />
          <StatCard
            title={__('Submissions Today', 'subtleforms')}
            value={stats.submissions_today}
            subtitle={__('Last 24 hours', 'subtleforms')}
            icon={<FiCalendar className='sf-w-6 sf-h-6 sf-text-purple-600' />}
          />
          <StatCard
            title={__('Submissions This Week', 'subtleforms')}
            value={stats.submissions_this_week}
            subtitle={__('Last 7 days', 'subtleforms')}
            icon={<FiTrendingUp className='sf-w-6 sf-h-6 sf-text-orange-600' />}
          />
        </div>

        <div className='sf-gap-6 sf-grid sf-grid-cols-1 lg:sf-grid-cols-2 sf-mb-6'>
          {/* Recent Submissions */}
          <div>
            <Card>
              <CardHeader>
                <h2>{__('Recent Submissions', 'subtleforms')}</h2>
              </CardHeader>
              <CardBody>
                {recent_submissions.length > 0 ? (
                  <div className='subtleforms-dashboard-list'>
                    {recent_submissions.map((submission) => (
                      <div
                        key={submission.id}
                        className='subtleforms-dashboard-list-item'>
                        <div className='item-content'>
                          <div className='item-title'>
                            <a
                              href={`admin.php?page=subtleforms-submissions&submission_id=${submission.id}`}>
                              {submission.form_title}
                            </a>
                          </div>
                          <div className='item-meta'>
                            <span
                              className={`status-badge status-${submission.status}`}>
                              {submission.status}
                            </span>
                            <span className='time-ago'>
                              {submission.time_ago}
                            </span>
                          </div>
                        </div>
                        <Button
                          variant='secondary'
                          isSmall
                          href={`admin.php?page=subtleforms-submissions&submission_id=${submission.id}`}>
                          {__('View', 'subtleforms')}
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className='subtleforms-dashboard-empty'>
                    <p>{__('No submissions yet.', 'subtleforms')}</p>
                    <p className='description'>
                      {__(
                        'Submissions will appear here once users start submitting your forms.',
                        'subtleforms'
                      )}
                    </p>
                  </div>
                )}
                {recent_submissions.length > 0 && (
                  <div className='subtleforms-dashboard-footer'>
                    <Button
                      variant='link'
                      href='admin.php?page=subtleforms-submissions'>
                      {__('View all submissions →', 'subtleforms')}
                    </Button>
                  </div>
                )}
              </CardBody>
            </Card>
          </div>

          {/* Recently Edited Forms */}
          <div>
            <Card>
              <CardHeader>
                <h2>{__('Recently Edited Forms', 'subtleforms')}</h2>
              </CardHeader>
              <CardBody>
                {recent_forms.length > 0 ? (
                  <div className='subtleforms-dashboard-list'>
                    {recent_forms.map((form) => (
                      <div
                        key={form.id}
                        className='subtleforms-dashboard-list-item'>
                        <div className='item-content'>
                          <div className='item-title'>
                            <a
                              href={`admin.php?page=subtleforms-new-form&form_id=${form.id}`}>
                              {form.title}
                            </a>
                          </div>
                          <div className='item-meta'>
                            {/* Form Type Badge */}
                            {(() => {
                              const formType = form.metadata?.type || 'regular';
                              const typeConfig = {
                                regular: {
                                  icon: FiFileText,
                                  label: __('Regular', 'subtleforms'),
                                  color: 'gray',
                                },
                                multistep: {
                                  icon: FiLayers,
                                  label: __('Multi-step', 'subtleforms'),
                                  color: 'purple',
                                },
                                sectioned: {
                                  icon: FiList,
                                  label: __('Sectioned', 'subtleforms'),
                                  color: 'indigo',
                                },
                                conversational: {
                                  icon: FiMessageCircle,
                                  label: __('Conversational', 'subtleforms'),
                                  color: 'blue',
                                },
                                payment: {
                                  icon: FiCreditCard,
                                  label: __('Payment', 'subtleforms'),
                                  color: 'green',
                                },
                              };
                              const config =
                                typeConfig[formType] || typeConfig.regular;
                              const Icon = config.icon;
                              return (
                                <span
                                  className={clsx(
                                    'sf-inline-flex sf-items-center sf-gap-1 sf-px-2 sf-py-0.5 sf-text-xs sf-font-medium sf-border',
                                    {
                                      'sf-bg-gray-50 sf-text-gray-600 sf-border-gray-200':
                                        config.color === 'gray',
                                      'sf-bg-purple-50 sf-text-purple-600 sf-border-purple-200':
                                        config.color === 'purple',
                                      'sf-bg-indigo-50 sf-text-indigo-600 sf-border-indigo-200':
                                        config.color === 'indigo',
                                      'sf-bg-blue-50 sf-text-blue-600 sf-border-blue-200':
                                        config.color === 'blue',
                                      'sf-bg-green-50 sf-text-green-600 sf-border-green-200':
                                        config.color === 'green',
                                    }
                                  )}
                                  style={{ borderRadius: '3px' }}>
                                  <Icon className='sf-w-3 sf-h-3' />
                                  {config.label}
                                </span>
                              );
                            })()}
                            <span
                              className={`status-badge status-${form.status}`}>
                              {form.status}
                            </span>
                            <span className='submission-count'>
                              {form.submission_count}{' '}
                              {__('submissions', 'subtleforms')}
                            </span>
                            <span className='time-ago'>{form.time_ago}</span>
                          </div>
                        </div>
                        <Button
                          variant='secondary'
                          isSmall
                          href={`admin.php?page=subtleforms-new-form&form_id=${form.id}`}>
                          {__('Edit', 'subtleforms')}
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className='subtleforms-dashboard-empty'>
                    <p>{__('No forms yet.', 'subtleforms')}</p>
                    <p className='description'>
                      {__(
                        'Create your first form to get started.',
                        'subtleforms'
                      )}
                    </p>
                    <Button
                      variant='primary'
                      href='admin.php?page=subtleforms-new-form'>
                      {__('Create Form', 'subtleforms')}
                    </Button>
                  </div>
                )}
                {recent_forms.length > 0 && (
                  <div className='subtleforms-dashboard-footer'>
                    <Button
                      variant='link'
                      href='admin.php?page=subtleforms-forms'>
                      {__('View all forms →', 'subtleforms')}
                    </Button>
                  </div>
                )}
              </CardBody>
            </Card>
          </div>
        </div>

        {/* System Health */}
        <div>
          <Card>
            <CardHeader>
              <div className='sf-flex sf-justify-between sf-items-center'>
                <h2>{__('System Health', 'subtleforms')}</h2>
                <span
                  className={clsx(
                    'sf-inline-flex sf-items-center sf-gap-1.5 sf-px-2.5 sf-py-1 sf-text-xs sf-font-medium sf-rounded-full',
                    {
                      'sf-bg-green-50 sf-text-green-700':
                        system_health.status === 'healthy',
                      'sf-bg-yellow-50 sf-text-yellow-700':
                        system_health.status !== 'healthy',
                    }
                  )}>
                  {system_health.status === 'healthy' ? (
                    <>
                      <FiCheckCircle className='sf-w-3.5 sf-h-3.5' />{' '}
                      {__('Healthy', 'subtleforms')}
                    </>
                  ) : (
                    <>
                      <FiAlertCircle className='sf-w-3.5 sf-h-3.5' />{' '}
                      {__('Warning', 'subtleforms')}
                    </>
                  )}
                </span>
              </div>
            </CardHeader>
            <CardBody>
              <div className='sf-gap-4 sf-grid sf-grid-cols-2 md:sf-grid-cols-4'>
                <div className='sf-flex sf-flex-col'>
                  <span className='sf-mb-1 sf-text-gray-500 sf-text-xs'>
                    {__('Plugin Version', 'subtleforms')}
                  </span>
                  <span className='sf-font-medium sf-text-gray-900 sf-text-sm'>
                    {system_health.plugin_version}
                  </span>
                </div>
                <div className='sf-flex sf-flex-col'>
                  <span className='sf-mb-1 sf-text-gray-500 sf-text-xs'>
                    {__('WordPress', 'subtleforms')}
                  </span>
                  <span className='sf-font-medium sf-text-gray-900 sf-text-sm'>
                    {system_health.wordpress_version}
                  </span>
                </div>
                <div className='sf-flex sf-flex-col'>
                  <span className='sf-mb-1 sf-text-gray-500 sf-text-xs'>
                    {__('PHP Version', 'subtleforms')}
                  </span>
                  <span className='sf-font-medium sf-text-gray-900 sf-text-sm'>
                    {system_health.php_version}
                  </span>
                </div>
                <div className='sf-flex sf-flex-col'>
                  <span className='sf-mb-1 sf-text-gray-500 sf-text-xs'>
                    {__('Database', 'subtleforms')}
                  </span>
                  <span className='sf-font-medium sf-text-gray-900 sf-text-sm'>
                    {system_health.database_version}
                  </span>
                </div>
                <div className='sf-flex sf-flex-col'>
                  <span className='sf-mb-1 sf-text-gray-500 sf-text-xs'>
                    {__('Memory Limit', 'subtleforms')}
                  </span>
                  <span className='sf-font-medium sf-text-gray-900 sf-text-sm'>
                    {system_health.memory_limit}
                  </span>
                </div>
                <div className='sf-flex sf-flex-col'>
                  <span className='sf-mb-1 sf-text-gray-500 sf-text-xs'>
                    {__('Max Upload', 'subtleforms')}
                  </span>
                  <span className='sf-font-medium sf-text-gray-900 sf-text-sm'>
                    {system_health.max_upload_size}
                  </span>
                </div>
                <div className='sf-flex sf-flex-col'>
                  <span className='sf-mb-1 sf-text-gray-500 sf-text-xs'>
                    {__('Debug Mode', 'subtleforms')}
                  </span>
                  <span className='sf-font-medium sf-text-gray-900 sf-text-sm'>
                    {system_health.debug_mode
                      ? __('Enabled', 'subtleforms')
                      : __('Disabled', 'subtleforms')}
                  </span>
                </div>
                <div className='sf-flex sf-flex-col'>
                  <span className='sf-mb-1 sf-text-gray-500 sf-text-xs'>
                    {__('Autosave', 'subtleforms')}
                  </span>
                  <span className='sf-font-medium sf-text-gray-900 sf-text-sm'>
                    {system_health.autosave_enabled
                      ? __('Enabled', 'subtleforms')
                      : __('Disabled', 'subtleforms')}
                  </span>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </AdminShell>
  );
}

/**
 * Stat Card Component
 */
function StatCard({ title, value, subtitle, icon, link }) {
  const content = (
    <>
      <div className='stat-icon'>{icon}</div>
      <div className='stat-content'>
        <div className='stat-value'>{value.toLocaleString()}</div>
        <div className='stat-title'>{title}</div>
        {subtitle && <div className='stat-subtitle'>{subtitle}</div>}
      </div>
    </>
  );

  if (link) {
    return (
      <a href={link} className='subtleforms-stat-card'>
        {content}
      </a>
    );
  }

  return <div className='subtleforms-stat-card'>{content}</div>;
}
