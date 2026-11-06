import { useState } from '@wordpress/element';
import { Button } from '@wordpress/components';
import { __, _n, sprintf } from '@wordpress/i18n';
import { submissionStatus } from '../utils/submissionStatus';
import { getBranding } from '../utils/branding';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { useDashboardStats } from '../data';
import { NavLink } from '../components/navigation';
import Icon from '../ui/Icon';
import AdminShell from '../components/AdminShell';
import ExtensionSlot from '../components/ExtensionSlot';
import { getSlotItems } from '../../shared/extend';
import './DashboardPage.scss';
import TrendChart from '../components/TrendChart';
import SpamProtectionNotice from '../components/SpamProtectionNotice';
import MoreFeaturesCard from '../components/MoreFeaturesCard';

const formatNumber = (value) => Number(value || 0).toLocaleString();

/** Days the chart can show. */
export const TREND_RANGES = [7, 30, 90];

/**
 * Change between two periods as text for a tile: "+12%", "-4%", "No change",
 * or "New" when the period before had nothing.
 *
 * @param {number} current  This period.
 * @param {number} previous The period before.
 * @return {{text: string, tone: 'up'|'down'|'flat'}}
 */
export function deltaText(current, previous) {
  const now = Number(current || 0);
  const before = Number(previous || 0);
  if (before === 0) {
    return now === 0
      ? { text: __('No entries in either week', 'subtleforms'), tone: 'flat' }
      : { text: __('New this week', 'subtleforms'), tone: 'up' };
  }
  const pct = Math.round(((now - before) / before) * 100);
  if (pct === 0) {
    return { text: __('No change from the week before', 'subtleforms'), tone: 'flat' };
  }
  return {
    text: sprintf(
      /* translators: %s: percentage change such as +12% */
      __('%s from the week before', 'subtleforms'),
      `${pct > 0 ? '+' : ''}${pct}%`
    ),
    tone: pct > 0 ? 'up' : 'down',
  };
}

/**
 * Dashboard, what is happening across every form, at a glance.
 * Every figure comes from one request (GET /dashboard, preloaded with the page).
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
    top_forms: topForms = [],
    system_health: health = {},
    trend = [],
    attention = {},
    checklist = { show: false, steps: [] },
  } = data;

  const unread =
    stats.unread_submissions ?? Number(window.subtleformsAdmin?.unreadCount || 0);
  const delta = deltaText(stats.submissions_this_week, stats.submissions_prev_week);

  return (
    <AdminShell
      title={__('Dashboard', 'subtleforms')}
      description={__('Everything happening across your forms.', 'subtleforms')}
      actions={headerActions}>
      <div className='sf-dash'>
        {/* One-time offer to turn spam protection on (2.6.0) */}
        <SpamProtectionNotice />

        {checklist.show && <GettingStarted steps={checklist.steps} />}

        {/* Row 1: four tiles, each opens the matching Submissions view */}
        <section
          className='sf-kpis'
          aria-label={__('Key figures', 'subtleforms')}>
          <Kpi
            label={__('Entries today', 'subtleforms')}
            value={stats.submissions_today}
            meta={__('Since midnight', 'subtleforms')}
            to='/submissions?range=today'
          />
          <Kpi
            label={__('Entries, last 7 days', 'subtleforms')}
            value={stats.submissions_this_week}
            meta={delta.text}
            tone={delta.tone}
            to='/submissions?range=7days'
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
            to='/submissions?tab=unread'
          />
          <Kpi
            label={__('Spam blocked, last 7 days', 'subtleforms')}
            value={stats.spam_blocked_week}
            meta={__('Never reached your inbox', 'subtleforms')}
            to='/submissions?tab=spam'
          />
          {/* Tiles add-ons bring. */}
          <ExtensionSlot name='dashboard.tiles' data={data} />
        </section>

        {/* Row 2: chart and what needs attention */}
        <div className='sf-dash__row sf-dash__row--wide'>
          <TrendPanel trend={trend} />
          <AttentionPanel attention={attention} data={data} />
        </div>

        {/* Panels add-ons bring. */}
        <ExtensionSlot name='dashboard.panels' forms={recentForms} />
        <ExtensionSlot name='dashboard.widgets' data={data} forms={recentForms} />

        {/* Row 3: recent entries and top forms */}
        <div className='sf-dash__row'>
          <RecentEntries entries={recentSubmissions} />
          <TopForms forms={topForms} />
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

/** Steps of the Getting started list, in order, with where each one is done. */
function checklistItems() {
  return {
    create_form: { label: __('Create a form', 'subtleforms'), to: '/forms/new' },
    add_to_page: {
      label: __('Add it to a page with the SubtleForms block or the shortcode', 'subtleforms'),
      to: '/forms',
    },
    notification_email: {
      label: __('Choose where notification emails go', 'subtleforms'),
      to: '/settings',
      hash: 'tab=email',
    },
    spam_protection: {
      label: __('Turn on spam protection', 'subtleforms'),
      to: '/settings',
      hash: 'tab=security',
    },
  };
}

/**
 * Getting started: shown while the site has no form or no entry yet, then gone.
 * It belongs to the site, so every administrator sees the same list.
 */
export function GettingStarted({ steps = [] }) {
  const navigate = useNavigate();
  const items = checklistItems();
  const done = steps.filter((step) => step.done).length;
  return (
    <section className='sf-panel sf-start' aria-labelledby='sf-start-title'>
      <header className='sf-panel__header'>
        <div>
          <h2 className='sf-panel__title' id='sf-start-title'>
            {__('Getting started', 'subtleforms')}
          </h2>
          <p className='sf-panel__subtitle'>
            {sprintf(
              /* translators: 1: steps done, 2: number of steps */
              __('%1$d of %2$d done', 'subtleforms'),
              done,
              steps.length
            )}
          </p>
        </div>
      </header>
      <div className='sf-panel__body sf-panel__body--flush'>
        <ol className='sf-start__list'>
          {steps.map((step) => {
            const item = items[step.id];
            if (!item) {
              return null;
            }
            return (
              <li key={step.id} className={clsx('sf-start__item', { 'is-done': step.done })}>
                <span className='sf-start__mark' aria-hidden='true'>
                  {step.done ? <Icon.Check size={12} /> : null}
                </span>
                <button
                  type='button'
                  className='sf-start__link'
                  onClick={() => {
                    if (item.hash) {
                      window.location.hash = item.hash;
                    }
                    navigate(item.to);
                  }}>
                  {item.label}
                </button>
                {step.done && <span className='screen-reader-text'>{__('Done', 'subtleforms')}</span>}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

/** Submissions per day with a 7, 30 or 90 day choice. */
export function TrendPanel({ trend = [] }) {
  const [days, setDays] = useState(30);
  const shown = trend.slice(-days);
  const total = shown.reduce((sum, d) => sum + d.count, 0);
  return (
    <section className='sf-panel'>
      <header className='sf-panel__header'>
        <div>
          <h2 className='sf-panel__title'>
            {sprintf(
              /* translators: %d: number of days */
              __('Submissions, last %d days', 'subtleforms'),
              days
            )}
          </h2>
          <p className='sf-panel__subtitle'>
            {sprintf(
              /* translators: %s: number of entries */
              _n('%s entry in this period', '%s entries in this period', total, 'subtleforms'),
              formatNumber(total)
            )}
          </p>
        </div>
        <div className='sf-range' role='group' aria-label={__('Period', 'subtleforms')}>
          {TREND_RANGES.map((range) => (
            <button
              key={range}
              type='button'
              className={clsx('sf-range__option', { 'is-active': range === days })}
              aria-pressed={range === days}
              onClick={() => setDays(range)}>
              {sprintf(
                /* translators: %d: number of days */
                __('%d days', 'subtleforms'),
                range
              )}
            </button>
          ))}
        </div>
      </header>
      <div className='sf-panel__body'>
        {total === 0 ? (
          <p className='sf-dash__empty-line'>
            {__('No entries in this period yet. They show here as soon as a form is submitted.', 'subtleforms')}
          </p>
        ) : (
          <TrendChart
            data={shown}
            compact
            caption={sprintf(
              /* translators: %d: number of days */
              __('Submissions per day, last %d days', 'subtleforms'),
              days
            )}
          />
        )}
      </div>
    </section>
  );
}

/** A link to a Settings tab (the tab is kept in the address hash). */
function HashLink({ hash, className, children }) {
  const navigate = useNavigate();
  return (
    <a
      href={`#${hash}`}
      className={className}
      onClick={(event) => {
        event.preventDefault();
        window.location.hash = hash;
        navigate('/settings');
      }}>
      {children}
    </a>
  );
}

/** What needs a look: unread entries, quiet forms, add-on rows and failures. */
export function AttentionPanel({ attention = {}, data }) {
  const unread = Number(attention.unread || 0);
  const idle = attention.idle_forms || { count: 0, forms: [] };
  const failures = Number(attention.integration_failures || 0);
  const addOnRows = getSlotItems('dashboard.attention');
  const nothing = unread === 0 && idle.count === 0 && failures === 0 && addOnRows.length === 0;

  return (
    <section className='sf-panel'>
      <header className='sf-panel__header'>
        <h2 className='sf-panel__title'>{__('Needs attention', 'subtleforms')}</h2>
      </header>
      <div className='sf-panel__body sf-panel__body--flush'>
        {nothing ? (
          <p className='sf-dash__empty-line'>{__('Nothing needs attention.', 'subtleforms')}</p>
        ) : (
          <ul className='sf-attn'>
            {unread > 0 && (
              <li>
                <NavLink to='/submissions?tab=unread' className='sf-attn__row'>
                  <span className='sf-attn__count'>{formatNumber(unread)}</span>
                  <span className='sf-attn__text'>
                    {_n('unread entry', 'unread entries', unread, 'subtleforms')}
                  </span>
                  <Icon.ChevronRight size={16} className='sf-list__chevron' aria-hidden='true' />
                </NavLink>
              </li>
            )}
            {idle.count > 0 && (
              <li>
                <NavLink to='/forms' className='sf-attn__row'>
                  <span className='sf-attn__count'>{formatNumber(idle.count)}</span>
                  <span className='sf-attn__text'>
                    {_n(
                      'published form with no entries in 30 days',
                      'published forms with no entries in 30 days',
                      idle.count,
                      'subtleforms'
                    )}
                    {idle.forms.length > 0 && (
                      <span className='sf-attn__sub'>
                        {idle.forms.map((form) => form.title).join(', ')}
                      </span>
                    )}
                  </span>
                  <Icon.ChevronRight size={16} className='sf-list__chevron' aria-hidden='true' />
                </NavLink>
              </li>
            )}
            {failures > 0 && (
              <li>
                <HashLink hash='tab=logs' className='sf-attn__row'>
                  <span className='sf-attn__count sf-attn__count--warn'>{formatNumber(failures)}</span>
                  <span className='sf-attn__text'>
                    {_n(
                      'integration failure in the last 7 days',
                      'integration failures in the last 7 days',
                      failures,
                      'subtleforms'
                    )}
                  </span>
                  <Icon.ChevronRight size={16} className='sf-list__chevron' aria-hidden='true' />
                </HashLink>
              </li>
            )}
            <ExtensionSlot name='dashboard.attention' data={data} />
          </ul>
        )}
      </div>
    </section>
  );
}

/** The latest entries: form, who sent it, when, and an unread dot. */
export function RecentEntries({ entries = [] }) {
  return (
    <section className='sf-panel'>
      <header className='sf-panel__header'>
        <h2 className='sf-panel__title'>{__('Recent entries', 'subtleforms')}</h2>
        {entries.length > 0 && (
          <NavLink to='/submissions' className='sf-panel__link'>
            {__('View all', 'subtleforms')}
            <Icon.ArrowRight size={14} aria-hidden='true' />
          </NavLink>
        )}
      </header>
      <div className='sf-panel__body sf-panel__body--flush'>
        {entries.length > 0 ? (
          <ul className='sf-list'>
            {entries.slice(0, 8).map((entry) => {
              const unreadEntry = entry.is_read === false;
              const who = entry.name || entry.email;
              return (
                <li key={entry.id}>
                  <NavLink to={`/submissions/${entry.id}`} className='sf-list__row'>
                    <span
                      className={clsx('sf-list__marker', { 'is-unread': unreadEntry })}
                      aria-hidden='true'
                    />
                    {unreadEntry && <span className='screen-reader-text'>{__('Unread', 'subtleforms')}</span>}
                    <span className='sf-list__main'>
                      <span className='sf-list__title'>{entry.form_title}</span>
                      <span className='sf-list__meta'>
                        {who && <span>{who}</span>}
                        {who && entry.name && entry.email && <span aria-hidden='true'>·</span>}
                        {entry.name && entry.email && <span>{entry.email}</span>}
                      </span>
                    </span>
                    {entry.status && !['completed', 'saved'].includes(entry.status) && (
                      <span className={clsx('sf-pill', submissionStatus(entry.status).cls)}>
                        {submissionStatus(entry.status).label}
                      </span>
                    )}
                    <span className='sf-list__time'>
                      {sprintf(
                        /* translators: %s: time since the entry, such as "5 mins" */
                        __('%s ago', 'subtleforms'),
                        entry.time_ago
                      )}
                    </span>
                  </NavLink>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className='sf-empty'>
            <span className='sf-empty__icon'>
              <Icon.Inbox size={20} />
            </span>
            <p className='sf-empty__title'>{__('No entries yet', 'subtleforms')}</p>
            <p className='sf-empty__text'>
              {__('Entries appear here as soon as someone submits one of your forms.', 'subtleforms')}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

/** Forms ranked by entries in the last 30 days. Add-ons add columns. */
export function TopForms({ forms = [] }) {
  const columns = getSlotItems('dashboard.top_forms.column');
  return (
    <section className='sf-panel'>
      <header className='sf-panel__header'>
        <div>
          <h2 className='sf-panel__title'>{__('Top forms', 'subtleforms')}</h2>
          <p className='sf-panel__subtitle'>{__('Entries in the last 30 days', 'subtleforms')}</p>
        </div>
        {forms.length > 0 && (
          <NavLink to='/forms' className='sf-panel__link'>
            {__('All forms', 'subtleforms')}
            <Icon.ArrowRight size={14} aria-hidden='true' />
          </NavLink>
        )}
      </header>
      <div className='sf-panel__body sf-panel__body--flush'>
        {forms.length > 0 ? (
          <table className='sf-top'>
            <thead className='screen-reader-text'>
              <tr>
                <th scope='col'>{__('Form', 'subtleforms')}</th>
                <th scope='col'>{__('Entries', 'subtleforms')}</th>
                {columns.map((column) => (
                  <th key={column.id} scope='col'>{column.header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {forms.map((form) => (
                <tr key={form.id}>
                  <td className='sf-top__name'>
                    <NavLink to={`/forms/${form.id}`}>{form.title}</NavLink>
                  </td>
                  <td className='sf-top__num'>{formatNumber(form.entries)}</td>
                  {columns.map((column) => {
                    const Cell = column.component;
                    return (
                      <td key={column.id} className='sf-top__num'>
                        <Cell form={form} />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className='sf-empty'>
            <span className='sf-empty__icon'>
              <Icon.FileText size={20} />
            </span>
            <p className='sf-empty__title'>{__('No entries in the last 30 days', 'subtleforms')}</p>
            <p className='sf-empty__text'>
              {__('The forms that receive the most entries are listed here.', 'subtleforms')}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * KPI tile. Linked tiles navigate inside the app.
 */
function Kpi({ label, value, meta, to, accent = false, tone }) {
  const body = (
    <>
      <span className='sf-kpi__label'>
        {accent && <span className='sf-kpi__dot' aria-hidden='true' />}
        {label}
      </span>
      <span className='sf-kpi__value'>{formatNumber(value)}</span>
      {meta && <span className={clsx('sf-kpi__meta', tone && `is-${tone}`)}>{meta}</span>}
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

function HealthItem({ label, value }) {
  return (
    <div className='sf-health-grid__item'>
      <dt>{label}</dt>
      <dd>{value || '-'}</dd>
    </div>
  );
}

