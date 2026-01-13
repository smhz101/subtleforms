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
import Icon from '../components/ui/Icon';
import AdminShell from '../components/AdminShell';
import './DashboardPage.scss';

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
        <div className='sf-dashboard-actions'>
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
        <div className='sf-stats-grid'>
          <StatCard
            title={__('Total Forms', 'subtleforms')}
            value={stats.total_forms}
            subtitle={`${stats.published_forms} published, ${stats.draft_forms} draft`}
            icon={<Icon.FileText className='sf-text-blue-600 sf-icon-lg' />}
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
            icon={<Icon.Database className='sf-text-green-600 sf-icon-lg' />}
            link='admin.php?page=subtleforms-submissions'
          />
          <StatCard
            title={__('Submissions Today', 'subtleforms')}
            value={stats.submissions_today}
            subtitle={__('Last 24 hours', 'subtleforms')}
            icon={
              <Icon.Calendar className='sf-text-purple-600 sf-icon-lg' />
            }
          />
          <StatCard
            title={__('Submissions This Week', 'subtleforms')}
            value={stats.submissions_this_week}
            subtitle={__('Last 7 days', 'subtleforms')}
            icon={
              <Icon.TrendingUp className='sf-text-orange-600 sf-icon-lg' />
            }
          />
        </div>

        <div className='sf-content-grid'>
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
                                  icon: Icon.FileText,
                                  label: __('Regular', 'subtleforms'),
                                  color: 'gray',
                                },
                                multistep: {
                                  icon: Icon.Layers,
                                  label: __('Multi-step', 'subtleforms'),
                                  color: 'purple',
                                },
                                sectioned: {
                                  icon: Icon.List,
                                  label: __('Sectioned', 'subtleforms'),
                                  color: 'indigo',
                                },
                                conversational: {
                                  icon: Icon.MessageCircle,
                                  label: __('Conversational', 'subtleforms'),
                                  color: 'blue',
                                },
                                payment: {
                                  icon: Icon.CreditCard,
                                  label: __('Payment', 'subtleforms'),
                                  color: 'green',
                                },
                              };
                              const config =
                                typeConfig[formType] || typeConfig.regular;
                              const IconComponent = config.icon;
                              return (
                                <span
                                  className={clsx('sf-form-type-badge', {
                                    'sf-type-gray': config.color === 'gray',
                                    'sf-type-purple': config.color === 'purple',
                                    'sf-type-indigo': config.color === 'indigo',
                                    'sf-type-blue': config.color === 'blue',
                                    'sf-type-green': config.color === 'green',
                                  })}>
                                  <IconComponent className='sf-icon-sm' />
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
              <div className='sf-system-health-header'>
                <h2>{__('System Health', 'subtleforms')}</h2>
                <span
                  className={clsx('sf-badge', {
                    'sf-badge-healthy': system_health.status === 'healthy',
                    'sf-badge-warning': system_health.status !== 'healthy',
                  })}>
                  {system_health.status === 'healthy' ? (
                    <>
                      <Icon.CheckCircle className='sf-icon-md' />{' '}
                      {__('Healthy', 'subtleforms')}
                    </>
                  ) : (
                    <>
                      <Icon.AlertCircle className='sf-icon-md' />{' '}
                      {__('Warning', 'subtleforms')}
                    </>
                  )}
                </span>
              </div>
            </CardHeader>
            <CardBody>
              <div className='sf-system-health-grid'>
                <div className='sf-system-info-item'>
                  <span className='sf-label'>
                    {__('Plugin Version', 'subtleforms')}
                  </span>
                  <span className='sf-value'>
                    {system_health.plugin_version}
                  </span>
                </div>
                <div className='sf-system-info-item'>
                  <span className='sf-label'>
                    {__('WordPress', 'subtleforms')}
                  </span>
                  <span className='sf-value'>
                    {system_health.wordpress_version}
                  </span>
                </div>
                <div className='sf-system-info-item'>
                  <span className='sf-label'>
                    {__('PHP Version', 'subtleforms')}
                  </span>
                  <span className='sf-value'>
                    {system_health.php_version}
                  </span>
                </div>
                <div className='sf-system-info-item'>
                  <span className='sf-label'>
                    {__('Database', 'subtleforms')}
                  </span>
                  <span className='sf-value'>
                    {system_health.database_version}
                  </span>
                </div>
                <div className='sf-system-info-item'>
                  <span className='sf-label'>
                    {__('Memory Limit', 'subtleforms')}
                  </span>
                  <span className='sf-value'>
                    {system_health.memory_limit}
                  </span>
                </div>
                <div className='sf-system-info-item'>
                  <span className='sf-label'>
                    {__('Max Upload', 'subtleforms')}
                  </span>
                  <span className='sf-value'>
                    {system_health.max_upload_size}
                  </span>
                </div>
                <div className='sf-system-info-item'>
                  <span className='sf-label'>
                    {__('Debug Mode', 'subtleforms')}
                  </span>
                  <span className='sf-value'>
                    {system_health.debug_mode
                      ? __('Enabled', 'subtleforms')
                      : __('Disabled', 'subtleforms')}
                  </span>
                </div>
                <div className='sf-system-info-item'>
                  <span className='sf-label'>
                    {__('Autosave', 'subtleforms')}
                  </span>
                  <span className='sf-value'>
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
