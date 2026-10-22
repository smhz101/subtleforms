import { ToggleControl } from '@wordpress/components';
import { __, _n, sprintf } from '@wordpress/i18n';
import { useSpamStats } from '../../data';
import { spamReasonRows } from '../../utils/spamReasons';

/**
 * A form's own spam protection (2.6.0): the hidden trap field and the
 * too-fast check, stored in schema.metadata.spam, plus how much spam this
 * form blocked in the last 30 days.
 *
 * A form saved before 2.6.0 has no own choice; the switches then show what
 * the server actually does for it (the `fallback` from GET /spam/stats).
 *
 * @param {Object}   props
 * @param {Object}   props.schema     Form schema.
 * @param {Function} props.onMetadata (key, value) => void.
 * @param {boolean}  props.isReadOnly Read only.
 * @param {number}   props.formId     Form ID (0 before the form is saved).
 * @param {Object}   props.stats      Preloaded stats (tests).
 */
export default function SpamProtectionPanel({ schema, onMetadata, isReadOnly = false, formId: givenId = 0, stats: preloaded }) {
  const formId = Number(givenId) || 0;
  const query = useSpamStats({ days: 30, formId }, { enabled: !preloaded && formId > 0 });
  const stats = preloaded || query.data;

  const own = schema?.metadata?.spam || {};
  const fallback = stats?.fallback || { honeypot: true, timeTrap: true };
  const honeypot = typeof own.honeypot === 'boolean' ? own.honeypot : fallback.honeypot;
  const timeTrap = typeof own.timeTrap === 'boolean' ? own.timeTrap : fallback.timeTrap;
  const seconds = Number(stats?.min_seconds || 3);

  const set = (key, value) => {
    if (isReadOnly) return;
    onMetadata('spam', { honeypot, timeTrap, [key]: value });
  };

  const total = Number(stats?.total || 0);
  const rows = spamReasonRows(stats?.reasons);

  return (
    <>
      <ToggleControl
        __nextHasNoMarginBottom
        label={__('Hidden trap field', 'subtleforms')}
        help={__(
          'Adds a field that visitors never see and robots fill in. Anything sent with it filled in is dropped quietly.',
          'subtleforms'
        )}
        checked={honeypot}
        disabled={isReadOnly}
        onChange={(value) => set('honeypot', value)}
      />
      <ToggleControl
        __nextHasNoMarginBottom
        label={__('Too-fast check', 'subtleforms')}
        help={sprintf(
          /* translators: %s: number of seconds */
          _n(
            'Drops anything sent less than %s second after the form loaded. People need longer than that to fill in a form.',
            'Drops anything sent less than %s seconds after the form loaded. People need longer than that to fill in a form.',
            seconds,
            'subtleforms'
          ),
          seconds
        )}
        checked={timeTrap}
        disabled={isReadOnly}
        onChange={(value) => set('timeTrap', value)}
      />

      <div className='sf-spam-panel__count' role='status' aria-live='polite'>
        {formId <= 0 && (
          <p>{__('Spam blocked on this form is counted once the form is saved.', 'subtleforms')}</p>
        )}
        {formId > 0 && !stats && <p>{__('Loading spam counts…', 'subtleforms')}</p>}
        {stats && total === 0 && <p>{__('No spam blocked yet.', 'subtleforms')}</p>}
        {stats && total > 0 && (
          <>
            <p>
              <strong>
                {sprintf(
                  /* translators: %s: number of blocked spam messages */
                  _n(
                    '%s spam message blocked on this form in the last 30 days.',
                    '%s spam messages blocked on this form in the last 30 days.',
                    total,
                    'subtleforms'
                  ),
                  total.toLocaleString()
                )}
              </strong>
            </p>
            <ul className='sf-spam-panel__reasons'>
              {rows.map((row) => (
                <li key={row.key}>
                  {sprintf(
                    /* translators: 1: reason, 2: number blocked */
                    __('%1$s: %2$s', 'subtleforms'),
                    row.label,
                    row.count.toLocaleString()
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </>
  );
}
