import { useEffect, useState } from '@wordpress/element';
import { Button, Spinner, TextControl } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import Icon from '../../../ui/Icon';
import { mailchimpApi, announceStatus } from './api';
import './mailchimp.scss';

const BADGES = {
  connected: { label: __('Connected', 'subtleforms'), tone: 'ok' },
  error: { label: __('Needs attention', 'subtleforms'), tone: 'warn' },
  none: { label: __('Not set up', 'subtleforms'), tone: 'none' },
};

/**
 * Status badge of the connection.
 *
 * @param {Object} props
 * @param {string} props.status connected, error or none.
 */
export function StatusBadge({ status }) {
  const badge = BADGES[status] || BADGES.none;
  return <span className={`sf-mc-badge sf-mc-badge--${badge.tone}`}>{badge.label}</span>;
}

/**
 * The Mailchimp connection card: API key, test and status.
 *
 * The saved key is never shown. A saved key appears as a masked line with
 * its last four characters and a "Change key" button.
 *
 * @param {Object}   props
 * @param {Function} props.onChange Called with the connection state after every change.
 */
export default function ConnectionCard({ onChange }) {
  const [state, setState] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [editing, setEditing] = useState(false);
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState('');
  const [result, setResult] = useState({ tone: '', text: '' });

  const apply = (next) => {
    setState(next);
    announceStatus(next.status);
    if (onChange) onChange(next);
  };

  useEffect(() => {
    let cancelled = false;
    mailchimpApi
      .state()
      .then((s) => {
        if (!cancelled) apply(s);
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e?.message || __('Could not load the Mailchimp connection.', 'subtleforms'));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loadError) {
    return <p className='sf-mc-card__error'>{loadError}</p>;
  }
  if (!state) {
    return (
      <p role='status' className='sf-mc-card__loading'>
        <Spinner /> {__('Loading…', 'subtleforms')}
      </p>
    );
  }

  const showField = !state.has_key || editing;

  const save = async () => {
    setBusy('save');
    setResult({ tone: '', text: '' });
    try {
      const next = await mailchimpApi.connect(key.trim());
      setKey('');
      setEditing(false);
      apply(next);
      setResult({
        tone: 'ok',
        text:
          next.account_name
            ? sprintf(
                /* translators: 1: Mailchimp account name, 2: account email */
                __('Connected to %1$s (%2$s).', 'subtleforms'),
                next.account_name,
                next.account_email
              )
            : __('Connected.', 'subtleforms'),
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
      const res = await mailchimpApi.test();
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
      apply(await mailchimpApi.disconnect());
      setEditing(false);
    } catch (e) {
      setResult({ tone: 'error', text: e?.message || __('Could not remove the key.', 'subtleforms') });
    }
    setBusy('');
  };

  let summary = __('Add your Mailchimp API key to connect this site to your account.', 'subtleforms');
  if (state.status === 'connected' && state.account_name) {
    summary = sprintf(
      /* translators: 1: Mailchimp account name, 2: account email */
      __('Connected to %1$s (%2$s).', 'subtleforms'),
      state.account_name,
      state.account_email
    );
  } else if (state.status === 'connected') {
    summary = __('Connected.', 'subtleforms');
  } else if (state.status === 'error') {
    summary = state.error || __('Mailchimp did not accept the saved key. Test the connection or change the key.', 'subtleforms');
  }

  return (
    <section className='sf-mc-card' aria-labelledby='sf-mc-card-title'>
      <header className='sf-mc-card__head'>
        <h3 id='sf-mc-card-title' className='sf-mc-card__title'>
          {__('Connection', 'subtleforms')}
        </h3>
        <StatusBadge status={state.status} />
      </header>
      {!(result.text && result.tone === 'ok') && <p className='sf-mc-card__summary'>{summary}</p>}

      {showField ? (
        <div className='sf-mc-card__key'>
          <TextControl
            label={__('API key', 'subtleforms')}
            type='password'
            autoComplete='off'
            value={key}
            onChange={setKey}
            placeholder={__('Paste your Mailchimp API key', 'subtleforms')}
            help={__('In Mailchimp, open your profile, then Extras, then API keys, and create a key. It ends with a dash and the data center, for example -us21.', 'subtleforms')}
          />
          <div className='sf-mc-card__actions'>
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
        <div className='sf-mc-card__key'>
          <p className='sf-mc-card__masked'>
            <span className='sf-mc-card__masked-label'>{__('API key', 'subtleforms')}</span>
            <span className='sf-mc-card__masked-value' aria-label={sprintf(
              /* translators: %s: last four characters of the saved key */
              __('Saved key ending in %s', 'subtleforms'),
              state.last4
            )}>
              {'•'.repeat(16)}
              {state.last4}
            </span>
          </p>
          <div className='sf-mc-card__actions'>
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
        <p role='status' className={`sf-mc-card__result sf-mc-card__result--${result.tone}`}>
          {result.tone === 'ok' ? <Icon.CheckCircle size={14} aria-hidden='true' /> : <Icon.AlertCircle size={14} aria-hidden='true' />}
          <span>{result.text}</span>
        </p>
      )}
    </section>
  );
}
