import { useState } from '@wordpress/element';
import { Button, TextControl } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import Icon from '../../../ui/Icon';
import { emailMarketingApi, announceService } from './api';
import { uiFor } from './serviceUi';
import './emailMarketing.scss';

const BADGES = {
  connected: { label: __('Connected', 'subtleforms'), tone: 'ok' },
  error: { label: __('Needs attention', 'subtleforms'), tone: 'warn' },
  none: { label: __('Not set up', 'subtleforms'), tone: 'none' },
};

/**
 * Status badge of a connection.
 *
 * @param {Object} props
 * @param {string} props.status connected, error or none.
 */

const connectedText = (name, email) => {
  if (!name) {
    return __('Connected.', 'subtleforms');
  }
  if (!email) {
    /* translators: %s: account name */
    return sprintf(__('Connected to %s.', 'subtleforms'), name);
  }
  /* translators: 1: account name, 2: account email */
  return sprintf(__('Connected to %1$s (%2$s).', 'subtleforms'), name, email);
};

export function StatusBadge({ status }) {
  const badge = BADGES[status] || BADGES.none;
  return <span className={`sf-em-badge sf-em-badge--${badge.tone}`}>{badge.label}</span>;
}

/**
 * The connection of one service: API key, test and status.
 *
 * The saved key is never shown. A saved key appears as a masked line with its
 * last four characters and a "Change key" button. Disconnect removes the key;
 * the switch and the service's settings stay.
 *
 * @param {Object}   props
 * @param {string}   props.service  Service slug.
 * @param {string}   props.label    Service name.
 * @param {Object}   props.state    Connection state from the server.
 * @param {Function} props.onState  Called with the new state after every change.
 */
export default function ServiceConnection({ service, label, state, onState }) {
  const ui = uiFor(service);
  const [editing, setEditing] = useState(false);
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState('');
  const [result, setResult] = useState({ tone: '', text: '' });

  const apply = (next) => {
    announceService(service, { status: next.status });
    onState(next);
  };

  const showField = !state.has_key || editing;

  const save = async () => {
    setBusy('save');
    setResult({ tone: '', text: '' });
    try {
      const next = await emailMarketingApi.connect(service, key.trim());
      setKey('');
      setEditing(false);
      apply(next);
      setResult({
        tone: 'ok',
        text: connectedText(next.account_name, next.account_email),
      });
    } catch (e) {
      setResult({ tone: 'error', text: e?.message || __('The connection failed.', 'subtleforms') });
    }
    setBusy('');
  };

  const test = async () => {
    setBusy('test');
    setResult({ tone: '', text: '' });
    try {
      const res = await emailMarketingApi.test(service);
      if (res.state) apply(res.state);
      setResult({ tone: res.ok ? 'ok' : 'error', text: res.message || (res.ok ? __('Connected.', 'subtleforms') : __('The connection failed.', 'subtleforms')) });
    } catch (e) {
      setResult({ tone: 'error', text: e?.message || __('The connection failed.', 'subtleforms') });
    }
    setBusy('');
  };

  const disconnect = async () => {
    setBusy('disconnect');
    setResult({ tone: '', text: '' });
    try {
      apply(await emailMarketingApi.disconnect(service));
      setEditing(false);
    } catch (e) {
      setResult({ tone: 'error', text: e?.message || __('Could not remove the key.', 'subtleforms') });
    }
    setBusy('');
  };

  let summary = sprintf(
    /* translators: %s: service name */
    __('Add your %s API key to connect this site to your account.', 'subtleforms'),
    label
  );
  if (state.status === 'connected') {
    summary = connectedText(state.account_name, state.account_email);
  } else if (state.status === 'error') {
    summary =
      state.error ||
      sprintf(
        /* translators: %s: service name */
        __('%s did not accept the saved key. Test the connection or change the key.', 'subtleforms'),
        label
      );
  }

  const titleId = `sf-em-conn-${service}`;

  return (
    <section className='sf-em-card' aria-labelledby={titleId}>
      <header className='sf-em-card__head'>
        <h3 id={titleId} className='sf-em-card__title'>
          {__('Connection', 'subtleforms')}
        </h3>
        <StatusBadge status={state.status} />
      </header>
      {!(result.text && result.tone === 'ok') && <p className='sf-em-card__summary'>{summary}</p>}

      {showField ? (
        <div className='sf-em-card__key'>
          <TextControl
            label={__('API key', 'subtleforms')}
            type='password'
            autoComplete='off'
            value={key}
            onChange={setKey}
            placeholder={ui.keyPlaceholder}
            help={ui.keyHelp || undefined}
          />
          {ui.keyLink && (
            <p className='sf-em-card__link'>
              <a href={ui.keyLink} target='_blank' rel='noopener noreferrer'>
                {ui.keyLinkText}
                <span className='sf-sr-only'> {__('(opens in a new tab)', 'subtleforms')}</span>
              </a>
            </p>
          )}
          <div className='sf-em-card__actions'>
            <Button variant='primary' onClick={save} isBusy={busy === 'save'} disabled={!key.trim() || !!busy}>
              {__('Save and connect', 'subtleforms')}
            </Button>
            {state.has_key && (
              <Button
                variant='tertiary'
                onClick={() => {
                  setEditing(false);
                  setKey('');
                  setResult({ tone: '', text: '' });
                }}
                disabled={!!busy}>
                {__('Cancel', 'subtleforms')}
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className='sf-em-card__key'>
          <p className='sf-em-card__masked'>
            <span className='sf-em-card__masked-label'>{__('API key', 'subtleforms')}</span>
            <span
              className='sf-em-card__masked-value'
              aria-label={sprintf(
                /* translators: %s: last four characters of the saved key */
                __('Saved key ending in %s', 'subtleforms'),
                state.last4
              )}>
              {'•'.repeat(16)}
              {state.last4}
            </span>
          </p>
          <div className='sf-em-card__actions'>
            <Button variant='secondary' onClick={test} isBusy={busy === 'test'} disabled={!!busy}>
              {__('Test connection', 'subtleforms')}
            </Button>
            <Button variant='tertiary' onClick={() => setEditing(true)} disabled={!!busy}>
              {__('Change key', 'subtleforms')}
            </Button>
            <Button variant='tertiary' isDestructive onClick={disconnect} disabled={!!busy}>
              {__('Disconnect', 'subtleforms')}
            </Button>
          </div>
        </div>
      )}

      {result.text && (
        <p role='status' className={`sf-em-card__result sf-em-card__result--${result.tone}`}>
          {result.tone === 'ok' ? <Icon.CheckCircle size={14} aria-hidden='true' /> : <Icon.AlertCircle size={14} aria-hidden='true' />}
          <span>{result.text}</span>
        </p>
      )}
    </section>
  );
}
