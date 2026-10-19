import { useState } from '@wordpress/element';
import { Button } from '@wordpress/components';
import { __, _n, sprintf } from '@wordpress/i18n';
import { getBranding } from '../utils/branding';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { useDashboardStats } from '../data';
import { NavLink } from '../components/navigation';
import Icon from '../ui/Icon';
import AdminShell from '../components/AdminShell';
import FormAnalyticsPanel from '../components/analytics/FormAnalyticsPanel';
import { getFormTypeBadge, getFormStatusBadge } from '../utils/formMeta';
import './DashboardPage.scss';
import { chartColumnProps } from '../utils/chartA11y';

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
            meta={__('Since midnight (UTC)', 'subtleforms')}
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
                  title={__('Extensions', 'subtleforms')}
                  text={__('Webhooks, CRM, payments and more', 'subtleforms')}
                  to='/extensions'
                />
              </ul>
            </div>
          </section>
        </div>

        {/* Activity */}
        {/* Views, submissions and conversion (2.1, Pro reports) */}
        <FormAnalyticsPanel forms={recentForms} />

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
  const map = {
    completed: { label: __('Completed', 'subtleforms'), cls: 'sf-pill--success' },
    processing: { label: __('Processing', 'subtleforms'), cls: 'sf-pill--info' },
    failed: { label: __('Failed', 'subtleforms'), cls: 'sf-pill--danger' },
    payment_pending: { label: __('Awaiting payment', 'subtleforms'), cls: 'sf-pill--warning' },
    spam: { label: __('Spam', 'subtleforms'), cls: 'sf-pill--danger' },
    flagged: { label: __('Flagged', 'subtleforms'), cls: 'sf-pill--warning' },
  };
  const config = map[status] || { label: __('Received', 'subtleforms'), cls: '' };
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

/**
 * Daily submissions bar chart.
 *
 * One series, so no legend: the panel title names it. Bars are a single hue
 * with 4px rounded tops anchored to the baseline and a 2px gap. Each bar has a
 * hover/focus tooltip, and the numbers are also exposed as a visually hidden
 * table for screen readers.
 */
function TrendChart({ data = [] }) {
  const [active, setActive] = useState(null);

  if (!data.length) {
    return null;
  }

  const max = Math.max(1, ...data.map((d) => d.count));
  // A tidy axis maximum (1, 2, 5, 10, 20, 50…).
  const niceMax = (() => {
    const pow = 10 ** Math.floor(Math.log10(max));
    const n = max / pow;
    const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
    return step * pow;
  })();

  const formatDay = (iso, opts) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, opts);

  const lastIndex = data.length - 1;

  return (
    <div className='sf-trend'>
      <div className='sf-trend__plot'>
        <div className='sf-trend__grid' aria-hidden='true'>
          <span data-value={formatNumber(niceMax)} />
          <span data-value={formatNumber(niceMax / 2)} />
          <span data-value='0' />
        </div>
        <div
          className='sf-trend__bars'
          onMouseLeave={() => setActive(null)}>
          <ul className='screen-reader-text'>
            {data.map((day) => (
              <li key={day.date}>
                {sprintf(
                  /* translators: 1: date, 2: number of submissions */
                  _n('%1$s: %2$s submission', '%1$s: %2$s submissions', day.count, 'subtleforms'),
                  formatDay(day.date, { month: 'short', day: 'numeric' }),
                  formatNumber(day.count)
                )}
              </li>
            ))}
          </ul>
          {data.map((day, index) => {
            const height = (day.count / niceMax) * 100;
            const label = sprintf(
              /* translators: 1: date, 2: number of submissions */
              _n('%1$s: %2$s submission', '%1$s: %2$s submissions', day.count, 'subtleforms'),
              formatDay(day.date, { month: 'short', day: 'numeric' }),
              formatNumber(day.count)
            );
            return (
              <div
                key={day.date}
                className={clsx('sf-trend__col', {
                  'is-active': active === index,
                  'is-today': index === lastIndex,
                })}
                tabIndex={0}
                {...chartColumnProps(label)}
                onMouseEnter={() => setActive(index)}
                onFocus={() => setActive(index)}
                onBlur={() => setActive(null)}>
                <span
                  className='sf-trend__bar'
                  style={{ height: day.count > 0 ? `max(${height}%, 3px)` : 0 }}
                />
                {active === index && (
                  <span className='sf-trend__tip' role='tooltip'>
                    <strong>{formatNumber(day.count)}</strong>
                    <span>
                      {formatDay(day.date, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className='sf-trend__axis' aria-hidden='true'>
        <span>{formatDay(data[0].date, { month: 'short', day: 'numeric' })}</span>
        <span>
          {formatDay(data[Math.floor(lastIndex / 2)].date, {
            month: 'short',
            day: 'numeric',
          })}
        </span>
        <span>{__('Today', 'subtleforms')}</span>
      </div>
      <table className='screen-reader-text'>
        <caption>{__('Submissions per day, last 14 days', 'subtleforms')}</caption>
        <thead>
          <tr>
            <th scope='col'>{__('Date', 'subtleforms')}</th>
            <th scope='col'>{__('Submissions', 'subtleforms')}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((day) => (
            <tr key={day.date}>
              <td>{day.date}</td>
              <td>{day.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
