import { submissionStatus } from '../utils/submissionStatus';
import { Button } from '@wordpress/components';
import { __, _n, sprintf } from '@wordpress/i18n';
import { getBranding } from '../utils/branding';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { useDashboardStats } from '../data';
import { NavLink } from '../components/navigation';
import Icon from '../ui/Icon';
import AdminShell from '../components/AdminShell';
import ExtensionSlot from '../components/ExtensionSlot';
import { getFormTypeBadge, getFormStatusBadge } from '../utils/formMeta';
import './DashboardPage.scss';
import TrendChart from '../components/TrendChart';
import SpamBlockedCard from '../components/SpamBlockedCard';
import SpamProtectionNotice from '../components/SpamProtectionNotice';
import MoreFeaturesCard from '../components/MoreFeaturesCard';

const formatNumber = (value) => Number(value || 0).toLocaleString();

/**
 * Dashboard, what is happening across every form, at a glance.
 */
export default function Dashboard() {
  const navigate = useNavigate();
  const { data, isLoading: loading, error, refetch } = useDashboardStats();

  const headerActions = (
    <Button
      variant='primary'
      icon={<Icon.Plus size={16} />}
      onClick={() => navigate('/forms/new')}>
      {__('New form', 'subtleforms')}
    </Button>
  );

  if (loading || error || !data) {
    return (
      <AdminShell
        title={__('Dashboard', 'subtleforms')}
        description={__('Everything happening across your forms.', 'subtleforms')}
        actions={headerActions}
        isLoading={loading}
        loadingLabel={__('Loading dashboard…', 'subtleforms')}
        error={
          error
            ? error?.message ||
              __('Failed to load dashboard data', 'subtleforms')
            : null
        }
        onRetry={() => refetch()}
      />
    );
  }

  const {
    stats = {},
    recent_submissions: recentSubmissions = [],
    recent_forms: recentForms = [],
    system_health: health = {},
    trend = [],
  } = data;

  const unread =
    stats.unread_submissions ?? Number(window.subtleformsAdmin?.unreadCount || 0);

  return (
    <AdminShell
      title={__('Dashboard', 'subtleforms')}
      description={__('Everything happening across your forms.', 'subtleforms')}
      actions={headerActions}>
      <div className='sf-dash'>
        {/* One-time offer to turn spam protection on (2.6.0) */}
        <SpamProtectionNotice />

        {/* KPIs */}
        <section
          className='sf-kpis'
          aria-label={__('Key figures', 'subtleforms')}>
          <Kpi
            label={__('Submissions', 'subtleforms')}
            value={stats.total_submissions}
            meta={
              stats.published_forms > 0
                ? sprintf(
                    /* translators: %s: average submissions per published form */
                    __('%s avg per published form', 'subtleforms'),
                    stats.avg_submissions_per_form
                  )
                : __('No published forms yet', 'subtleforms')
            }
            to='/submissions'
          />
          <Kpi
            label={__('Unread', 'subtleforms')}
            value={unread}
            meta={
              unread > 0
                ? __('Waiting for review', 'subtleforms')
                : __('Inbox zero', 'subtleforms')
            }
            accent={unread > 0}
            to='/submissions'
          />
          <Kpi
            label={__('Today', 'subtleforms')}
            value={stats.submissions_today}
            meta={__('Since midnight', 'subtleforms')}
          />
          <Kpi
            label={__('Last 7 days', 'subtleforms')}
            value={stats.submissions_this_week}
            meta={sprintf(
              /* translators: %s: number of forms */
              _n('Across %s form', 'Across %s forms', stats.total_forms || 0, 'subtleforms'),
              formatNumber(stats.total_forms)
            )}
          />
        </section>

        {/* Trend + quick actions */}
        <div className='sf-dash__row sf-dash__row--wide'>
          <section className='sf-panel'>
            <header className='sf-panel__header'>
              <div>
                <h2 className='sf-panel__title'>
                  {__('Submissions', 'subtleforms')}
                </h2>
                <p className='sf-panel__subtitle'>
                  {__('Last 14 days', 'subtleforms')}
                </p>
              </div>
              <div className='sf-dash__trend-total'>
                <span className='sf-dash__trend-total-value'>
                  {formatNumber(trend.reduce((sum, d) => sum + d.count, 0))}
                </span>
                <span className='sf-dash__trend-total-label'>
                  {__('in period', 'subtleforms')}
                </span>
              </div>
            </header>
            <div className='sf-panel__body'>
              <TrendChart data={trend} />
            </div>
          </section>

          <section className='sf-panel'>
            <header className='sf-panel__header'>
              <h2 className='sf-panel__title'>
                {__('Quick actions', 'subtleforms')}
              </h2>
            </header>
            <div className='sf-panel__body sf-panel__body--flush'>
              <ul className='sf-quick'>
                <QuickAction
                  icon={Icon.Plus}
                  title={__('Create a form', 'subtleforms')}
                  text={__('Start blank or from a template', 'subtleforms')}
                  to='/forms/new'
                />
                <QuickAction
                  icon={Icon.Inbox}
                  title={__('Review submissions', 'subtleforms')}
                  text={
                    unread > 0
                      ? sprintf(
                          /* translators: %s: number of unread submissions */
                          _n('%s unread entry', '%s unread entries', unread, 'subtleforms'),
                          formatNumber(unread)
                        )
                      : __('You are all caught up', 'subtleforms')
                  }
                  to='/submissions'
                />
                <QuickAction
                  icon={Icon.Mail}
                  title={__('Email notifications', 'subtleforms')}
                  text={__('Sender, recipients and templates', 'subtleforms')}
                  to='/settings'
                  hash='tab=email'
                />
                <QuickAction
                  icon={Icon.Puzzle}
                  title={__('Integrations', 'subtleforms')}
                  text={__('Webhooks and the integrations your add-ons bring', 'subtleforms')}
                  to='/settings'
                  hash='tab=extensions'
                />
              </ul>
            </div>
          </section>
        </div>

        {/* Spam blocked in the last 30 days (2.6.0) */}
        <SpamBlockedCard />

        {/* Activity */}
        {/* Panels add-ons bring. */}
        <ExtensionSlot name='dashboard.panels' forms={recentForms} />

        <div className='sf-dash__row'>
          <section className='sf-panel'>
            <header className='sf-panel__header'>
              <h2 className='sf-panel__title'>
                {__('Recent submissions', 'subtleforms')}
              </h2>
              {recentSubmissions.length > 0 && (
                <NavLink to='/submissions' className='sf-panel__link'>
                  {__('View all', 'subtleforms')}
                  <Icon.ArrowRight size={14} aria-hidden='true' />
                </NavLink>
              )}
            </header>
            <div className='sf-panel__body sf-panel__body--flush'>
              {recentSubmissions.length > 0 ? (
                <ul className='sf-list'>
                  {recentSubmissions.slice(0, 6).map((submission) => (
                    <li key={submission.id}>
                      <NavLink
                        to={`/submissions/${submission.id}`}
                        className='sf-list__row'>
                        <span
                          className={clsx('sf-list__marker', {
                            'is-unread': submission.is_read === false || submission.status === 'unread',
                          })}
                          aria-hidden='true'
                        />
                        <span className='sf-list__main'>
                          <span className='sf-list__title'>
                            {submission.form_title}
                          </span>
                          <span className='sf-list__meta'>
                            <span className='sf-list__id'>#{submission.id}</span>
                            <span aria-hidden='true'>·</span>
                            <span>{submission.time_ago}</span>
                          </span>
                        </span>
                        <SubmissionStatus status={submission.status} />
                        <Icon.ChevronRight
                          size={16}
                          className='sf-list__chevron'
                          aria-hidden='true'
                        />
                      </NavLink>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className='sf-empty'>
                  <span className='sf-empty__icon'>
                    <Icon.Inbox size={20} />
                  </span>
                  <p className='sf-empty__title'>
                    {__('No submissions yet', 'subtleforms')}
                  </p>
                  <p className='sf-empty__text'>
                    {__(
                      'Entries appear here as soon as someone submits one of your forms.',
                      'subtleforms'
                    )}
                  </p>
                </div>
              )}
            </div>
          </section>

          <section className='sf-panel'>
            <header className='sf-panel__header'>
              <h2 className='sf-panel__title'>
                {__('Recently edited forms', 'subtleforms')}
              </h2>
              {recentForms.length > 0 && (
                <NavLink to='/forms' className='sf-panel__link'>
                  {__('All forms', 'subtleforms')}
                  <Icon.ArrowRight size={14} aria-hidden='true' />
                </NavLink>
              )}
            </header>
            <div className='sf-panel__body sf-panel__body--flush'>
              {recentForms.length > 0 ? (
                <ul className='sf-list'>
                  {recentForms.slice(0, 6).map((form) => {
                    const type = getFormTypeBadge(form);
                    const status = getFormStatusBadge(form);
                    const TypeIcon = type.icon;
                    return (
                      <li key={form.id}>
                        <NavLink
                          to={`/forms/${form.id}`}
                          className='sf-list__row'>
                          <span className='sf-list__icon' aria-hidden='true'>
                            <TypeIcon size={16} />
                          </span>
                          <span className='sf-list__main'>
                            <span className='sf-list__title'>{form.title}</span>
                            <span className='sf-list__meta'>
                              <span>{type.label}</span>
                              <span aria-hidden='true'>·</span>
                              <span>
                                {sprintf(
                                  /* translators: %s: number of submissions */
                                  _n('%s entry', '%s entries', form.submission_count || 0, 'subtleforms'),
                                  formatNumber(form.submission_count)
                                )}
                              </span>
                              <span aria-hidden='true'>·</span>
                              <span>{form.time_ago}</span>
                            </span>
                          </span>
                          <span
                            className={clsx('sf-pill', 'sf-pill--dot', {
                              'sf-pill--success': status.color === 'green',
                              'sf-pill--warning':
                                status.color === 'yellow' &&
                                form.has_unpublished_changes,
                            })}>
                            {status.color === 'green' || form.has_unpublished_changes
                              ? status.label
                              : __('Draft', 'subtleforms')}
                          </span>
                          <Icon.ChevronRight
                            size={16}
                            className='sf-list__chevron'
                            aria-hidden='true'
                          />
                        </NavLink>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className='sf-empty'>
                  <span className='sf-empty__icon'>
                    <Icon.FileText size={20} />
                  </span>
                  <p className='sf-empty__title'>
                    {__('No forms yet', 'subtleforms')}
                  </p>
                  <p className='sf-empty__text'>
                    {__(
                      'Create your first form to start collecting entries.',
                      'subtleforms'
                    )}
                  </p>
                  <div className='sf-empty__actions'>
                    <Button
                      variant='primary'
                      onClick={() => navigate('/forms/new')}>
                      {__('Create form', 'subtleforms')}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* System */}
        <section className='sf-panel sf-dash__health'>
          <header className='sf-panel__header'>
            <h2 className='sf-panel__title'>
              {__('System status', 'subtleforms')}
            </h2>
            <span
              className={clsx('sf-pill', 'sf-pill--dot', {
                'sf-pill--success': health.status === 'healthy',
                'sf-pill--warning': health.status !== 'healthy',
              })}>
              {health.status === 'healthy'
                ? __('All systems normal', 'subtleforms')
                : __('Needs attention', 'subtleforms')}
            </span>
          </header>
          <div className='sf-panel__body'>
            <dl className='sf-health-grid'>
              <HealthItem label={getBranding().name} value={health.plugin_version} />
              <HealthItem label={__('WordPress', 'subtleforms')} value={health.wordpress_version} />
              <HealthItem label={__('PHP', 'subtleforms')} value={health.php_version} />
              <HealthItem label={__('Database', 'subtleforms')} value={health.database_version} />
              <HealthItem label={__('Memory limit', 'subtleforms')} value={health.memory_limit} />
              <HealthItem label={__('Max upload', 'subtleforms')} value={health.max_upload_size} />
              <HealthItem
                label={__('Debug mode', 'subtleforms')}
                value={health.debug_mode ? __('On', 'subtleforms') : __('Off', 'subtleforms')}
              />
              <HealthItem
                label={__('Autosave', 'subtleforms')}
                value={health.autosave_enabled ? __('On', 'subtleforms') : __('Off', 'subtleforms')}
              />
            </dl>
          </div>
        </section>

        {/* What the separate SubtleForms Pro plugin adds; dismissible per user. */}
        <MoreFeaturesCard />
      </div>
    </AdminShell>
  );
}

/**
 * KPI tile. Linked tiles navigate inside the app.
 */
function Kpi({ label, value, meta, to, accent = false }) {
  const body = (
    <>
      <span className='sf-kpi__label'>
        {accent && <span className='sf-kpi__dot' aria-hidden='true' />}
        {label}
      </span>
      <span className='sf-kpi__value'>{formatNumber(value)}</span>
      {meta && <span className='sf-kpi__meta'>{meta}</span>}
    </>
  );

  if (to) {
    return (
      <NavLink to={to} className='sf-kpi sf-kpi--link'>
        {body}
      </NavLink>
    );
  }

  return <div className='sf-kpi'>{body}</div>;
}

function QuickAction({ icon: ActionIcon, title, text, to, hash }) {
  const navigate = useNavigate();
  return (
    <li>
      <a
        href={`#${hash || ''}`}
        className='sf-quick__item'
        onClick={(event) => {
          event.preventDefault();
          if (hash) {
            window.location.hash = hash;
          }
          navigate(to);
        }}>
        <span className='sf-quick__icon' aria-hidden='true'>
          <ActionIcon size={16} />
        </span>
        <span className='sf-quick__text'>
          <span className='sf-quick__title'>{title}</span>
          <span className='sf-quick__desc'>{text}</span>
        </span>
        <Icon.ChevronRight size={16} className='sf-quick__chevron' aria-hidden='true' />
      </a>
    </li>
  );
}

function SubmissionStatus({ status }) {
  const config = submissionStatus(status);
  return <span className={clsx('sf-pill', 'sf-pill--dot', config.cls)}>{config.label}</span>;
}

function HealthItem({ label, value }) {
  return (
    <div className='sf-health-grid__item'>
      <dt>{label}</dt>
      <dd>{value || '-'}</dd>
    </div>
  );
}

