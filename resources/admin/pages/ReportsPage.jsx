import { useMemo, useState } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';
import { Button, SelectControl, TextControl } from '@wordpress/components';
import clsx from 'clsx';
import AdminShell from '../components/AdminShell';
import DataTable from '../components/DataTable';
import ExtensionSlot from '../components/ExtensionSlot';
import TrendChart from '../components/TrendChart';
import Icon from '../ui/Icon';
import { useReport } from '../data';
import './DashboardPage.scss';
import './ReportsPage.scss';

const formatNumber = (value) => Number(value || 0).toLocaleString();

/** Presets of the date range; `days` counts today. */
export const PRESETS = [
  { value: 'today', days: 1 },
  { value: '7d', days: 7 },
  { value: '30d', days: 30 },
  { value: '90d', days: 90 },
];

const presetLabel = (value) =>
  ({
    today: __('Today', 'subtleforms'),
    '7d': __('Last 7 days', 'subtleforms'),
    '30d': __('Last 30 days', 'subtleforms'),
    '90d': __('Last 90 days', 'subtleforms'),
    custom: __('Custom range', 'subtleforms'),
  })[value];

/** Y-m-d of the site's today. */
export function siteToday() {
  const fromServer = window.subtleformsAdmin?.siteToday;
  if (typeof fromServer === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fromServer)) {
    return fromServer;
  }
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** A Y-m-d date moved by some days. */
export function shiftDate(date, days) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * The dates of a preset ending today.
 *
 * @param {string} preset One of PRESETS.
 * @param {string} today  Y-m-d.
 * @return {{from: string, to: string}}
 */
export function presetRange(preset, today = siteToday()) {
  const days = (PRESETS.find((p) => p.value === preset) || PRESETS[2]).days;
  return { from: shiftDate(today, -(days - 1)), to: today };
}

/** A spreadsheet reads a cell that starts with these as a formula. */
const csvCell = (value) => {
  let text = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`;
  }
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/**
 * The breakdown as CSV text.
 *
 * @param {Array} rows Breakdown rows.
 * @return {string}
 */
export function breakdownCsv(rows) {
  const head = [
    __('Form', 'subtleforms'),
    __('Entries', 'subtleforms'),
    __('Unread', 'subtleforms'),
    __('Spam blocked', 'subtleforms'),
    __('Share of total (%)', 'subtleforms'),
  ];
  const lines = [head, ...rows.map((r) => [r.title, r.entries, r.unread, r.spam, r.share])];
  return lines.map((line) => line.map(csvCell).join(',')).join('\n');
}

function saveCsv(text, name) {
  const blob = new Blob([String.fromCharCode(0xfeff), text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Change from the period before, as a short sentence. */
export function changeText(current, previous) {
  const now = Number(current || 0);
  const before = Number(previous || 0);
  if (before === 0) {
    return now === 0 ? __('No entries in either period', 'subtleforms') : __('None in the period before', 'subtleforms');
  }
  const pct = Math.round(((now - before) / before) * 100);
  return pct === 0
    ? __('Same as the period before', 'subtleforms')
    : sprintf(
        /* translators: %s: percentage such as +12% */
        __('%s from the period before', 'subtleforms'),
        `${pct > 0 ? '+' : ''}${pct}%`
      );
}

/** A tiny line of the entries per day of one form. */
export function Sparkline({ values = [] }) {
  const max = Math.max(1, ...values);
  const width = 96;
  const height = 24;
  if (!values.length || values.every((v) => v === 0)) {
    return <span className='sf-spark sf-spark--empty' aria-hidden='true'>{'-'}</span>;
  }
  const step = values.length > 1 ? width / (values.length - 1) : 0;
  const points = values
    .map((v, i) => `${(i * step).toFixed(1)},${(height - 2 - (v / max) * (height - 4)).toFixed(1)}`)
    .join(' ');
  return (
    <svg className='sf-spark' viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-hidden='true'>
      <polyline points={points} />
    </svg>
  );
}

/** How people answered one choice or rating field. */
export function FieldSummaryCard({ field }) {
  const max = Math.max(1, ...field.options.map((o) => o.count));
  const total = field.options.reduce((sum, o) => sum + o.count, 0);
  return (
    <section className='sf-panel sf-fieldsum'>
      <header className='sf-panel__header'>
        <div>
          <h3 className='sf-panel__title'>{field.label}</h3>
          <p className='sf-panel__subtitle'>
            {sprintf(
              /* translators: %s: number of entries that answered */
              _n('%s answer', '%s answers', field.answered, 'subtleforms'),
              formatNumber(field.answered)
            )}
            {field.average !== null && field.average !== undefined
              ? sprintf(
                  /* translators: %s: average rating */
                  __(', average %s', 'subtleforms'),
                  field.average
                )
              : ''}
          </p>
        </div>
      </header>
      <div className='sf-panel__body'>
        <ul className='sf-dist'>
          {field.options.map((option) => (
            <li key={option.value} className='sf-dist__row'>
              <span className='sf-dist__label'>{option.label}</span>
              <span className='sf-dist__track' aria-hidden='true'>
                <span className='sf-dist__bar' style={{ width: `${(option.count / max) * 100}%` }} />
              </span>
              <span className='sf-dist__count'>
                {formatNumber(option.count)}
                {total > 0 && <span className='sf-dist__pct'>{` ${Math.round((option.count / total) * 100)}%`}</span>}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/**
 * Reports: entries per day with the period before as a line, a sortable
 * breakdown per form and, for one form, how its choice and rating fields were
 * answered. The date range and the export sit in the page header.
 */
export default function ReportsPage() {
  const [preset, setPreset] = useState('30d');
  const [custom, setCustom] = useState(() => presetRange('30d'));
  const [formId, setFormId] = useState(0);
  const [sortBy, setSortBy] = useState('entries');
  const [sortDirection, setSortDirection] = useState('desc');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);

  const range = preset === 'custom' ? custom : presetRange(preset);
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(range.from) && /^\d{4}-\d{2}-\d{2}$/.test(range.to) && range.from <= range.to;
  const query = useReport({ from: range.from, to: range.to, formId }, { enabled: valid });
  const report = query.data;

  const rows = useMemo(() => {
    const list = [...(report?.breakdown || [])];
    const dir = sortDirection === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      const av = a[sortBy];
      const bv = b[sortBy];
      if (typeof av === 'string') {
        return av.localeCompare(bv) * dir;
      }
      return ((av || 0) - (bv || 0)) * dir;
    });
    return list;
  }, [report, sortBy, sortDirection]);

  const exportCsv = () => {
    saveCsv(breakdownCsv(rows), `subtleforms-report-${range.from}-to-${range.to}.csv`);
  };

  const header = (
    <>
      <div className='sf-report-range'>
        <SelectControl
          __nextHasNoMarginBottom
          size='compact'
          label={__('Date range', 'subtleforms')}
          hideLabelFromVision
          value={preset}
          options={[...PRESETS.map((p) => ({ value: p.value, label: presetLabel(p.value) })), { value: 'custom', label: presetLabel('custom') }]}
          onChange={(value) => {
            if (value === 'custom') {
              setCustom(presetRange(preset));
            }
            setPreset(value);
            setPage(1);
          }}
        />
        {preset === 'custom' && (
          <>
            <TextControl
              __nextHasNoMarginBottom
              type='date'
              label={__('From', 'subtleforms')}
              hideLabelFromVision
              value={custom.from}
              max={custom.to}
              onChange={(from) => setCustom({ ...custom, from })}
            />
            <TextControl
              __nextHasNoMarginBottom
              type='date'
              label={__('To', 'subtleforms')}
              hideLabelFromVision
              value={custom.to}
              min={custom.from}
              onChange={(to) => setCustom({ ...custom, to })}
            />
          </>
        )}
      </div>
      <Button
        variant='secondary'
        icon={<Icon.DownloadCloud size={16} />}
        onClick={exportCsv}
        disabled={!rows.length}
        accessibleWhenDisabled>
        {__('Export CSV', 'subtleforms')}
      </Button>
    </>
  );

  const forms = report?.forms || [];
  const totals = report?.totals || {};
  const formsTitle = (id) => forms.find((f) => f.id === id)?.title;
  const slice = rows.slice((page - 1) * perPage, page * perPage);

  const columns = [
    {
      key: 'title',
      title: __('Form', 'subtleforms'),
      sortable: true,
      render: (title, row) => (
        <button type='button' className='sf-report-form' onClick={() => { setFormId(row.id); setPage(1); }}>
          {title}
        </button>
      ),
    },
    { key: 'entries', title: __('Entries', 'subtleforms'), sortable: true, render: (v) => formatNumber(v) },
    { key: 'unread', title: __('Unread', 'subtleforms'), sortable: true, render: (v) => formatNumber(v) },
    { key: 'spam', title: __('Spam blocked', 'subtleforms'), sortable: true, render: (v) => formatNumber(v) },
    { key: 'share', title: __('Share', 'subtleforms'), sortable: true, render: (v) => `${v}%` },
    { key: 'days', title: __('Trend', 'subtleforms'), render: (days) => <Sparkline values={days} /> },
  ];

  return (
    <AdminShell
      title={__('Reports', 'subtleforms')}
      description={__('How many entries your forms receive. Spam, failed and trashed entries are not counted.', 'subtleforms')}
      actions={header}
      actionBarLeft={
        <div className='sf-report-toolbar'>
          <SelectControl
            __nextHasNoMarginBottom
            size='compact'
            label={__('Form', 'subtleforms')}
            hideLabelFromVision
            value={String(formId)}
            options={[
              { value: '0', label: __('All forms', 'subtleforms') },
              ...forms.map((f) => ({ value: String(f.id), label: f.title || sprintf(/* translators: %d: form id */ __('Form #%d', 'subtleforms'), f.id) })),
            ]}
            onChange={(value) => {
              setFormId(Number(value));
              setPage(1);
            }}
          />
        </div>
      }
      isLoading={!report && query.isLoading}
      error={!report && query.isError ? query.error?.message || __('Reports could not be loaded.', 'subtleforms') : null}
      onRetry={() => query.refetch()}>
      {report && (
        <div className={clsx('sf-dash', 'sf-reports', { 'is-refreshing': query.isFetching })}>
          <section className='sf-kpis' aria-label={__('Key figures', 'subtleforms')}>
            <Kpi
              label={__('Entries', 'subtleforms')}
              value={totals.entries}
              meta={changeText(totals.entries, totals.previous_entries)}
            />
            <Kpi
              label={__('Period before', 'subtleforms')}
              value={totals.previous_entries}
              meta={sprintf(
                /* translators: 1: first date, 2: last date */
                __('%1$s to %2$s', 'subtleforms'),
                report.previous.from,
                report.previous.to
              )}
            />
            <Kpi
              label={__('Unread', 'subtleforms')}
              value={totals.unread}
              meta={__('Entries in this period', 'subtleforms')}
              accent={Number(totals.unread) > 0}
            />
            <Kpi label={__('Spam blocked', 'subtleforms')} value={totals.spam} meta={__('Never reached your inbox', 'subtleforms')} />
          </section>

          <section className='sf-panel'>
            <header className='sf-panel__header'>
              <div>
                <h2 className='sf-panel__title'>
                  {formId ? sprintf(/* translators: %s: form title */ __('Submissions, %s', 'subtleforms'), formsTitle(formId) || '') : __('Submissions per day', 'subtleforms')}
                </h2>
                <p className='sf-panel__subtitle'>{`${report.range.from} to ${report.range.to}`}</p>
              </div>
              <div className='sf-dash__trend-total'>
                <span className='sf-dash__trend-total-value'>{formatNumber(totals.entries)}</span>
                <span className='sf-dash__trend-total-label'>{__('in period', 'subtleforms')}</span>
              </div>
            </header>
            <div className='sf-panel__body'>
              {Number(totals.entries) === 0 && Number(totals.previous_entries) === 0 ? (
                <p className='sf-dash__empty-line'>
                  {formId
                    ? __('This form has no entries in this period. Try a longer range.', 'subtleforms')
                    : __('No entries in this period. Try a longer range, or share a form to start collecting them.', 'subtleforms')}
                </p>
              ) : (
                <TrendChart
                  data={report.series}
                  compact
                  caption={__('Submissions per day', 'subtleforms')}
                />
              )}
            </div>
          </section>

          {/* More series add-ons bring (views and conversion). */}
          <ExtensionSlot name='reports.series' report={report} range={report.range} formId={formId} />

          <section className='sf-panel'>
            <header className='sf-panel__header'>
              <h2 className='sf-panel__title'>{__('By form', 'subtleforms')}</h2>
            </header>
            <div className='sf-panel__body sf-panel__body--flush'>
              <DataTable
                columns={columns}
                data={slice}
                totalItems={rows.length}
                currentPage={page}
                perPage={perPage}
                sortBy={sortBy}
                sortDirection={sortDirection}
                onSort={(key, dir) => {
                  setSortBy(key);
                  setSortDirection(dir);
                  setPage(1);
                }}
                onPageChange={setPage}
                onPerPageChange={(n) => {
                  setPerPage(n);
                  setPage(1);
                }}
                virtualize={false}
                emptyMessage={__('No forms received entries in this period.', 'subtleforms')}
              />
            </div>
          </section>

          {formId > 0 && (
            <section className='sf-reports__fields' aria-label={__('Answers by field', 'subtleforms')}>
              <h2 className='sf-reports__heading'>{__('Answers by field', 'subtleforms')}</h2>
              {report.field_summary.length === 0 ? (
                <p className='sf-dash__empty-line'>
                  {__('This form has no choice or rating fields to summarise.', 'subtleforms')}
                </p>
              ) : (
                <div className='sf-reports__fieldgrid'>
                  {report.field_summary.map((field) => (
                    <FieldSummaryCard key={field.key} field={field} />
                  ))}
                </div>
              )}
              {report.field_summary.some((f) => f.sampled) && (
                <p className='sf-reports__note'>
                  {__('The latest 5,000 entries of the period were read for these counts.', 'subtleforms')}
                </p>
              )}
            </section>
          )}

          {/* Panels add-ons bring. */}
          <ExtensionSlot name='reports.panels' forms={forms} />
        </div>
      )}
    </AdminShell>
  );
}

function Kpi({ label, value, meta, accent = false }) {
  return (
    <div className='sf-kpi'>
      <span className='sf-kpi__label'>
        {accent && <span className='sf-kpi__dot' aria-hidden='true' />}
        {label}
      </span>
      <span className='sf-kpi__value'>{formatNumber(value)}</span>
      {meta && <span className='sf-kpi__meta'>{meta}</span>}
    </div>
  );
}
