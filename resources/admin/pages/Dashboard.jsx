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
import classNames from 'classnames';
import {
  FiFileText,
  FiLayers,
  FiList,
  FiMessageCircle,
  FiCreditCard,
} from 'react-icons/fi';
import './Dashboard.css';

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
    <div className='subtleforms-dashboard'>
      <div className='subtleforms-dashboard-header'>
        <h1>{__('Dashboard', 'subtleforms')}</h1>
        <div className='subtleforms-dashboard-actions'>
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
      </div>

      {/* Stats Overview */}
      <div className='subtleforms-dashboard-stats'>
        <StatCard
          title={__('Total Forms', 'subtleforms')}
          value={stats.total_forms}
          subtitle={`${stats.published_forms} published, ${stats.draft_forms} draft`}
          icon='📝'
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
          icon='📊'
          link='admin.php?page=subtleforms-submissions'
        />
        <StatCard
          title={__('Submissions Today', 'subtleforms')}
          value={stats.submissions_today}
          subtitle={__('Last 24 hours', 'subtleforms')}
          icon='📅'
        />
        <StatCard
          title={__('Submissions This Week', 'subtleforms')}
          value={stats.submissions_this_week}
          subtitle={__('Last 7 days', 'subtleforms')}
          icon='📈'
        />
      </div>

      <div className='subtleforms-dashboard-content'>
        {/* Recent Submissions */}
        <div className='subtleforms-dashboard-section'>
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
        <div className='subtleforms-dashboard-section'>
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
                                className={classNames(
                                  'inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium border',
                                  {
                                    'bg-gray-50 text-gray-600 border-gray-200':
                                      config.color === 'gray',
                                    'bg-purple-50 text-purple-600 border-purple-200':
                                      config.color === 'purple',
                                    'bg-indigo-50 text-indigo-600 border-indigo-200':
                                      config.color === 'indigo',
                                    'bg-blue-50 text-blue-600 border-blue-200':
                                      config.color === 'blue',
                                    'bg-green-50 text-green-600 border-green-200':
                                      config.color === 'green',
                                  }
                                )}
                                style={{ borderRadius: '3px' }}>
                                <Icon className='w-3 h-3' />
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
      <div className='subtleforms-dashboard-system'>
        <Card>
          <CardHeader>
            <div className='system-header'>
              <h2>{__('System Health', 'subtleforms')}</h2>
              <span className={`health-status health-${system_health.status}`}>
                {system_health.status === 'healthy'
                  ? '✓ Healthy'
                  : '⚠ Warning'}
              </span>
            </div>
          </CardHeader>
          <CardBody>
            <div className='system-info-grid'>
              <div className='system-info-item'>
                <span className='label'>
                  {__('Plugin Version', 'subtleforms')}
                </span>
                <span className='value'>{system_health.plugin_version}</span>
              </div>
              <div className='system-info-item'>
                <span className='label'>{__('WordPress', 'subtleforms')}</span>
                <span className='value'>{system_health.wordpress_version}</span>
              </div>
              <div className='system-info-item'>
                <span className='label'>
                  {__('PHP Version', 'subtleforms')}
                </span>
                <span className='value'>{system_health.php_version}</span>
              </div>
              <div className='system-info-item'>
                <span className='label'>{__('Database', 'subtleforms')}</span>
                <span className='value'>{system_health.database_version}</span>
              </div>
              <div className='system-info-item'>
                <span className='label'>
                  {__('Memory Limit', 'subtleforms')}
                </span>
                <span className='value'>{system_health.memory_limit}</span>
              </div>
              <div className='system-info-item'>
                <span className='label'>{__('Max Upload', 'subtleforms')}</span>
                <span className='value'>{system_health.max_upload_size}</span>
              </div>
              <div className='system-info-item'>
                <span className='label'>{__('Debug Mode', 'subtleforms')}</span>
                <span className='value'>
                  {system_health.debug_mode
                    ? __('Enabled', 'subtleforms')
                    : __('Disabled', 'subtleforms')}
                </span>
              </div>
              <div className='system-info-item'>
                <span className='label'>{__('Autosave', 'subtleforms')}</span>
                <span className='value'>
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
