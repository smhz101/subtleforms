import { useState } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';
import clsx from 'clsx';
import { chartColumnProps } from '../utils/chartA11y';

const formatNumber = (value) => Number(value || 0).toLocaleString();

const formatDay = (iso, opts) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, opts);

/** Default bar label: "Oct 12: 4 submissions". */
const submissionsLabel = (day, date) =>
  sprintf(
    /* translators: 1: date, 2: number of submissions */
    _n('%1$s: %2$s submission', '%1$s: %2$s submissions', day.count, 'subtleforms'),
    date,
    formatNumber(day.count)
  );

/**
 * Daily bar chart, shared by the dashboard panels.
 *
 * One series, so no legend: the panel title names it. Bars are a single hue
 * with 4px rounded tops anchored to the baseline and a 2px gap. Each bar has a
 * hover/focus tooltip, and the numbers are also exposed as a visually hidden
 * table for screen readers.
 *
 * @param {Object}   props
 * @param {Array}    props.data        [{ date: 'Y-m-d', count }], oldest first.
 * @param {Function} props.label       (day, shortDate) => bar label for screen readers.
 * @param {string}   props.caption     Caption of the hidden table.
 * @param {string}   props.valueTitle  Column heading for the counts.
 * @param {boolean}  props.compact     Shorter plot, for a card.
 * @param {string}   props.previousLabel Name of the comparison line.
 *
 * A day may carry `previous`, the count of the same day in the period before.
 * They are drawn as a thin line over the bars.
 */
export default function TrendChart({
  data = [],
  label = submissionsLabel,
  caption = __('Submissions per day, last 14 days', 'subtleforms'),
  valueTitle = __('Submissions', 'subtleforms'),
  compact = false,
  previousLabel = __('Previous period', 'subtleforms'),
}) {
  const [active, setActive] = useState(null);

  if (!data.length) {
    return null;
  }

  const hasPrevious = data.some((d) => typeof d.previous === 'number');
  const max = Math.max(1, ...data.map((d) => Math.max(d.count, hasPrevious ? d.previous || 0 : 0)));
  // A tidy axis maximum (1, 2, 5, 10, 20, 50…).
  const niceMax = (() => {
    const pow = 10 ** Math.floor(Math.log10(max));
    const n = max / pow;
    const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
    return step * pow;
  })();

  const lastIndex = data.length - 1;
  const short = (day) => formatDay(day.date, { month: 'short', day: 'numeric' });

  return (
    <div className={clsx('sf-trend', { 'sf-trend--compact': compact })}>
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
              <li key={day.date}>{label(day, short(day))}</li>
            ))}
          </ul>
          {hasPrevious && (
            <svg
              className='sf-trend__previous'
              viewBox='0 0 100 100'
              preserveAspectRatio='none'
              aria-hidden='true'>
              <polyline
                vectorEffect='non-scaling-stroke'
                points={data
                  .map((d, i) => `${((i + 0.5) / data.length) * 100},${100 - ((d.previous || 0) / niceMax) * 100}`)
                  .join(' ')}
              />
            </svg>
          )}
          {data.map((day, index) => {
            const height = (day.count / niceMax) * 100;
            return (
              <div
                key={day.date}
                className={clsx('sf-trend__col', {
                  'is-active': active === index,
                  'is-today': index === lastIndex,
                })}
                tabIndex={0}
                {...chartColumnProps(label(day, short(day)))}
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
                    {hasPrevious && (
                      <span>
                        {sprintf(
                          /* translators: 1: number of entries, 2: name of the comparison period */
                          __('%1$s, %2$s', 'subtleforms'),
                          formatNumber(day.previous || 0),
                          previousLabel.toLowerCase()
                        )}
                      </span>
                    )}
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
      {hasPrevious && (
        <p className='sf-trend__legend' aria-hidden='true'>
          <span className='sf-trend__key sf-trend__key--bar' />
          {valueTitle}
          <span className='sf-trend__key sf-trend__key--line' />
          {previousLabel}
        </p>
      )}
      <div className='sf-trend__axis' aria-hidden='true'>
        <span>{short(data[0])}</span>
        <span>{short(data[Math.floor(lastIndex / 2)])}</span>
        <span>{__('Today', 'subtleforms')}</span>
      </div>
      <table className='screen-reader-text'>
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope='col'>{__('Date', 'subtleforms')}</th>
            <th scope='col'>{valueTitle}</th>
            {hasPrevious && <th scope='col'>{previousLabel}</th>}
          </tr>
        </thead>
        <tbody>
          {data.map((day) => (
            <tr key={day.date}>
              <td>{day.date}</td>
              <td>{day.count}</td>
              {hasPrevious && <td>{day.previous || 0}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
