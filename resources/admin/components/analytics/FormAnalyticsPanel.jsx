import { useState } from '@wordpress/element';
import { Button, SelectControl, Spinner } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import clsx from 'clsx';
import Icon from '../../ui/Icon';
import { requirePro } from '../../utils/featureGate';
import {
  ANALYTICS_DAYS,
  useAnalyticsSeries,
  formatRate,
  sampleSeries,
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
 * Dashboard panel: 30-day views, submissions and conversion, all forms or one.
 *
 * @param {Object} props
 * @param {Array}  props.forms Forms for the selector ({ id, title }).
 */
export default function FormAnalyticsPanel({ forms = [] }) {
  const [formId, setFormId] = useState(0);
  const { data, isLoading, error, locked } = useAnalyticsSeries(formId, ANALYTICS_DAYS);

  const series = locked ? sampleSeries(ANALYTICS_DAYS) : data?.series || [];
  const totals = locked
    ? {
        views: series.reduce((s, d) => s + d.views, 0),
        submissions: series.reduce((s, d) => s + d.submissions, 0),
      }
    : data?.totals || { views: 0, submissions: 0, conversion: null };
  const conversion = locked
    ? Math.round((totals.submissions / Math.max(1, totals.views)) * 1000) / 10
    : totals.conversion;

  return (
    <section className={clsx('sf-panel', 'sf-analytics-panel', { 'is-locked': locked })}>
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
        {!locked && forms.length > 0 && (
          <SelectControl
            className='sf-analytics-panel__select'
            label={__('Form', 'subtleforms')}
            hideLabelFromVision
            value={String(formId)}
            options={[
              { label: __('All forms', 'subtleforms'), value: '0' },
              ...forms.map((f) => ({
                /* translators: %d: form ID */
                label: f.title || sprintf(__('Form #%d', 'subtleforms'), f.id),
                value: String(f.id),
              })),
            ]}
            onChange={(v) => setFormId(Number(v))}
            __nextHasNoMarginBottom
          />
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

        {isLoading && !locked ? (
          <div className='sf-analytics-panel__loading'><Spinner /></div>
        ) : error && !locked ? (
          <p className='sf-analytics-panel__empty'>{error.message || __('Analytics could not be loaded.', 'subtleforms')}</p>
        ) : (
          <div className='sf-analytics-panel__chart' aria-hidden={locked ? 'true' : undefined}>
            <ViewsChart data={series} />
          </div>
        )}

        {!locked && !isLoading && !error && totals.views === 0 && totals.submissions === 0 && (
          <p className='sf-analytics-panel__empty'>
            {__('No views yet. Views are counted when a published form scrolls into sight on your site.', 'subtleforms')}
          </p>
        )}

        {locked && (
          <div className='sf-analytics-panel__lock'>
            <span className='sf-analytics-panel__lock-icon' aria-hidden='true'><Icon.Lock size={16} /></span>
            <div>
              <p className='sf-analytics-panel__lock-title'>{__('See which forms convert', 'subtleforms')}</p>
              <p className='sf-analytics-panel__lock-text'>
                {__('Sample data shown. Views are already being counted, so your reports are ready the moment you upgrade.', 'subtleforms')}
              </p>
            </div>
            <Button
              variant='primary'
              size='compact'
              onClick={() => requirePro('extensions.analytics', () => {}, { label: __('Analytics', 'subtleforms') })}>
              {__('Unlock analytics', 'subtleforms')}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
