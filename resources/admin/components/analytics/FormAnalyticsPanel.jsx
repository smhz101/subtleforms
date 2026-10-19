import { useState } from '@wordpress/element';
import { SelectControl, Spinner, TextControl } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import clsx from 'clsx';
import {
  ANALYTICS_DAYS,
  useAnalyticsSeries,
  formatRate,
} from './useAnalytics';
import './analytics.scss';

const fmt = (n) => Number(n || 0).toLocaleString();

/**
 * Grouped daily bars: views and submissions on one count axis.
 */
export function ViewsChart({ data = [] }) {
  const [active, setActive] = useState(null);
  if (!data.length) return null;

  const max = Math.max(1, ...data.map((d) => Math.max(d.views, d.submissions)));
  const pow = 10 ** Math.floor(Math.log10(max));
  const n = max / pow;
  const niceMax = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
  const day = (iso, opts) => new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, opts);
  const last = data.length - 1;

  return (
    <div className='sf-trend sf-views-chart'>
      <ul className='sf-views-chart__legend'>
        <li><span className='sf-views-chart__swatch sf-views-chart__swatch--views' />{__('Views', 'subtleforms')}</li>
        <li><span className='sf-views-chart__swatch sf-views-chart__swatch--subs' />{__('Submissions', 'subtleforms')}</li>
      </ul>
      <div className='sf-trend__plot'>
        <div className='sf-trend__grid' aria-hidden='true'>
          <span data-value={fmt(niceMax)} />
          <span data-value={fmt(niceMax / 2)} />
          <span data-value='0' />
        </div>
        <div className='sf-trend__bars' onMouseLeave={() => setActive(null)}>
          {data.map((d, i) => {
            const rate = d.views > 0 ? (d.submissions / d.views) * 100 : null;
            const label = sprintf(
              /* translators: 1: date, 2: views, 3: submissions */
              __('%1$s: %2$s views, %3$s submissions', 'subtleforms'),
              day(d.date, { month: 'short', day: 'numeric' }),
              fmt(d.views),
              fmt(d.submissions)
            );
            return (
              <div
                key={d.date}
                className={clsx('sf-trend__col', 'sf-views-chart__col', { 'is-active': active === i })}
                tabIndex={0}
                aria-label={label}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}>
                <span
                  className='sf-views-chart__bar sf-views-chart__bar--views'
                  style={{ height: d.views > 0 ? `max(${(d.views / niceMax) * 100}%, 3px)` : 0 }}
                />
                <span
                  className='sf-views-chart__bar sf-views-chart__bar--subs'
                  style={{ height: d.submissions > 0 ? `max(${(d.submissions / niceMax) * 100}%, 3px)` : 0 }}
                />
                {active === i && (
                  <span className='sf-trend__tip' role='tooltip'>
                    <span>{day(d.date, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                    <strong>
                      {sprintf(
                        /* translators: %s: number of views */
                        __('%s views', 'subtleforms'),
                        fmt(d.views)
                      )}
                    </strong>
                    <strong>
                      {sprintf(
                        /* translators: %s: number of submissions */
                        __('%s submissions', 'subtleforms'),
                        fmt(d.submissions)
                      )}
                    </strong>
                    <span>
                      {sprintf(
                        /* translators: %s: conversion rate */
                        __('Conversion %s', 'subtleforms'),
                        formatRate(rate === null ? null : Math.round(rate * 10) / 10)
                      )}
                    </span>
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className='sf-trend__axis' aria-hidden='true'>
        <span>{day(data[0].date, { month: 'short', day: 'numeric' })}</span>
        <span>{day(data[Math.floor(last / 2)].date, { month: 'short', day: 'numeric' })}</span>
        <span>{__('Today', 'subtleforms')}</span>
      </div>
      <table className='screen-reader-text'>
        <caption>{__('Views and submissions per day', 'subtleforms')}</caption>
        <thead>
          <tr>
            <th scope='col'>{__('Date', 'subtleforms')}</th>
            <th scope='col'>{__('Views', 'subtleforms')}</th>
            <th scope='col'>{__('Submissions', 'subtleforms')}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.date}>
              <td>{d.date}</td>
              <td>{d.views}</td>
              <td>{d.submissions}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Options for the form performance selector.
 *
 * Every form passed in is listed. There is no cap at the ten most recent.
 *
 * @param {Array}  forms Rows with id and title.
 * @param {string} query Optional title or id filter so older forms stay reachable.
 * @return {Array<{ label: string, value: string }>}
 */
export function performanceFormOptions(forms, query = '') {
  const list = Array.isArray(forms) ? forms : [];
  const needle = String(query || '').trim().toLowerCase();
  const matched = needle
    ? list.filter((form) => {
        const title = String(form.title || '').toLowerCase();
        return title.includes(needle) || String(form.id).includes(needle);
      })
    : list;

  return [
    { label: __('All forms', 'subtleforms'), value: '0' },
    ...matched.map((form) => ({
      /* translators: %d: form ID */
      label: form.title || sprintf(__('Form #%d', 'subtleforms'), form.id),
      value: String(form.id),
    })),
  ];
}

/**
 * Dashboard panel: 30-day views, submissions and conversion, all forms or one.
 *
 * @param {Object} props
 * @param {Array}  props.forms Every accessible non-trashed form ({ id, title }).
 */
export default function FormAnalyticsPanel({ forms = [] }) {
  const [formId, setFormId] = useState(0);
  const [formQuery, setFormQuery] = useState('');
  const { data, isLoading, error } = useAnalyticsSeries(formId, ANALYTICS_DAYS);

  const series = data?.series || [];
  const totals = data?.totals || { views: 0, submissions: 0, conversion: null };
  const conversion = totals.conversion;

  return (
    <section className='sf-panel sf-analytics-panel'>
      <header className='sf-panel__header'>
        <div>
          <h2 className='sf-panel__title'>{__('Form performance', 'subtleforms')}</h2>
          <p className='sf-panel__subtitle'>
            {sprintf(
              /* translators: %d: number of days */
              __('Views and submissions, last %d days', 'subtleforms'),
              ANALYTICS_DAYS
            )}
          </p>
        </div>
        {forms.length > 0 && (
          <div className='sf-analytics-panel__select'>
            <TextControl
              label={__('Find a form', 'subtleforms')}
              hideLabelFromVision
              value={formQuery}
              placeholder={__('Find a form', 'subtleforms')}
              onChange={setFormQuery}
              __nextHasNoMarginBottom
            />
            <SelectControl
              label={__('Form', 'subtleforms')}
              hideLabelFromVision
              value={String(formId)}
              options={performanceFormOptions(forms, formQuery)}
              onChange={(v) => setFormId(Number(v))}
              __nextHasNoMarginBottom
            />
          </div>
        )}
      </header>

      <div className='sf-panel__body'>
        <dl className='sf-analytics-panel__totals'>
          <div>
            <dt>{__('Views', 'subtleforms')}</dt>
            <dd>{fmt(totals.views)}</dd>
          </div>
          <div>
            <dt>{__('Submissions', 'subtleforms')}</dt>
            <dd>{fmt(totals.submissions)}</dd>
          </div>
          <div>
            <dt>{__('Conversion', 'subtleforms')}</dt>
            <dd>{formatRate(conversion)}</dd>
          </div>
        </dl>

        {isLoading ? (
          <div className='sf-analytics-panel__loading'><Spinner /></div>
        ) : error ? (
          <p className='sf-analytics-panel__empty'>{error.message || __('Analytics could not be loaded.', 'subtleforms')}</p>
        ) : (
          <div className='sf-analytics-panel__chart'>
            <ViewsChart data={series} />
          </div>
        )}

        {!isLoading && !error && totals.views === 0 && totals.submissions === 0 && (
          <p className='sf-analytics-panel__empty'>
            {__('No views yet. Views are counted when a published form scrolls into sight on your site.', 'subtleforms')}
          </p>
        )}

      </div>
    </section>
  );
}
