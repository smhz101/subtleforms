import { __, _n, sprintf } from '@wordpress/i18n';
import { Button } from '@wordpress/components';
import { useSpamStats } from '../data';
import Icon from '../ui/Icon';
import TrendChart from './TrendChart';
import { spamReasonRows } from '../utils/spamReasons';
import './SpamBlockedCard.scss';

const formatNumber = (value) => Number(value || 0).toLocaleString();

/** The headline sentence for a 30-day total. */
export function spamHeadline(total) {
  if (!total) {
    return __('No spam blocked yet.', 'subtleforms');
  }
  return sprintf(
    /* translators: %s: number of blocked spam messages */
    _n(
      'SubtleForms blocked %s spam message in the last 30 days.',
      'SubtleForms blocked %s spam messages in the last 30 days.',
      total,
      'subtleforms'
    ),
    formatNumber(total)
  );
}

/**
 * Dashboard card: spam blocked in the last 30 days, per day and by reason
 * (2.6.0). The counts come from GET /spam/stats.
 *
 * @param {Object} props
 * @param {Object} props.stats Preloaded stats (tests); fetched when omitted.
 */
export default function SpamBlockedCard({ stats: preloaded }) {
  const query = useSpamStats({ days: 30 }, { enabled: !preloaded });
  const stats = preloaded || query.data;
  const total = Number(stats?.total || 0);
  const rows = spamReasonRows(stats?.reasons);

  return (
    <section className='sf-panel sf-spam-card' aria-labelledby='sf-spam-card-title'>
      <header className='sf-panel__header'>
        <div>
          <h2 className='sf-panel__title' id='sf-spam-card-title'>
            {__('Spam blocked', 'subtleforms')}
          </h2>
          <p className='sf-panel__subtitle'>{__('Last 30 days', 'subtleforms')}</p>
        </div>
        {stats && (
          <div className='sf-dash__trend-total'>
            <span className='sf-dash__trend-total-value'>{formatNumber(total)}</span>
            <span className='sf-dash__trend-total-label'>{__('blocked', 'subtleforms')}</span>
          </div>
        )}
      </header>
      <div className='sf-panel__body'>
        {!stats && query.isError && (
          <div className='sf-spam-card__error' role='alert'>
            <p>{__('Spam counts could not be loaded.', 'subtleforms')}</p>
            <Button variant='secondary' size='compact' onClick={() => query.refetch()}>
              {__('Try again', 'subtleforms')}
            </Button>
          </div>
        )}
        {!stats && !query.isError && (
          <p className='sf-spam-card__loading' aria-busy='true'>
            {__('Loading spam counts…', 'subtleforms')}
          </p>
        )}
        {stats && (
          <>
            <p className='sf-spam-card__headline' aria-live='polite'>
              <Icon.ShieldCheck size={18} aria-hidden='true' />
              <span>{spamHeadline(total)}</span>
            </p>
            {total === 0 ? (
              <p className='sf-spam-card__hint'>
                {__(
                  'New forms have a hidden trap field and a too-fast check, so robots are stopped without a puzzle for your visitors. Blocked messages are counted here.',
                  'subtleforms'
                )}
              </p>
            ) : (
              <div className='sf-spam-card__grid'>
                <TrendChart
                  compact
                  data={stats.days || []}
                  label={(day, date) =>
                    sprintf(
                      /* translators: 1: date, 2: number of blocked spam messages */
                      __('%1$s: %2$s blocked', 'subtleforms'),
                      date,
                      formatNumber(day.count)
                    )
                  }
                  caption={__('Spam blocked per day, last 30 days', 'subtleforms')}
                  valueTitle={__('Blocked', 'subtleforms')}
                />
                <div className='sf-spam-card__reasons'>
                  <h3 className='sf-spam-card__reasons-title' id='sf-spam-card-reasons'>
                    {__('Why it was blocked', 'subtleforms')}
                  </h3>
                  <ul aria-labelledby='sf-spam-card-reasons'>
                    {rows.map((row) => (
                      <li key={row.key} className='sf-spam-card__reason'>
                        <span className='sf-spam-card__reason-label'>{row.label}</span>
                        <span className='sf-spam-card__reason-count'>{formatNumber(row.count)}</span>
                        <span
                          className='sf-spam-card__reason-bar'
                          aria-hidden='true'
                          style={{ width: `${Math.max(4, Math.round((row.count / total) * 100))}%` }}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
