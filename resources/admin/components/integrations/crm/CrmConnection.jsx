import { useState } from '@wordpress/element';
import { Button, TextControl } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import Icon from '../../../ui/Icon';
import { StatusBadge } from '../emailMarketing/ServiceConnection';
import { announceService } from './api';
import { useConnectService, useDisconnectService, useTestService } from './queries';
import '../emailMarketing/emailMarketing.scss';

const connectedText = (name) => {
  if (!name) {
    return __('Connected.', 'subtleforms');
  }
  /* translators: %s: account name */
  return sprintf(__('Connected to %s.', 'subtleforms'), name);
};

/**
 * The connection of one CRM: access token, test and status.
 *
 * The saved token is never shown. A saved token appears as a masked line with
 * its last four characters and a "Change token" button. Disconnect removes the
 * token; the switch and each form's settings stay. Like Email marketing, every
 * action here applies at once, so there is no Save button in the section.
 *
 * @param {Object}   props
 * @param {string}   props.service Service slug.
 * @param {string}   props.label   Service name.
 * @param {Object}   props.state   Connection state from the server.
 * @param {Function} props.onState Called with the new state after every change.
 * @param {Object}   props.ui      { tokenHelp, tokenLink, tokenLinkText, placeholder }.
 */
export default function CrmConnection({ service, label, state, onState, ui = {} }) {
  const [editing, setEditing] = useState(false);
  const [token, setToken] = useState('');
  const [result, setResult] = useState({ tone: '', text: '' });
  const connectMutation = useConnectService(service);
  const testMutation = useTestService(service);
  const disconnectMutation = useDisconnectService(service);
  const busy = connectMutation.isPending ? 'save' : testMutation.isPending ? 'test' : disconnectMutation.isPending ? 'disconnect' : '';

  const apply = (next) => {
    announceService(service, { status: next.status });
    onState(next);
  };

  const showField = !state.has_key || editing;

  const save = async () => {
    setResult({ tone: '', text: '' });
    try {
      const next = await connectMutation.mutateAsync(token.trim());
      setToken('');
      setEditing(false);
      apply(next);
      setResult({ tone: 'ok', text: connectedText(next.account_name) });
    } catch (e) {
      setResult({ tone: 'error', text: e?.message || __('The connection failed.', 'subtleforms') });
    }
  };

  const test = async () => {
    setResult({ tone: '', text: '' });
    try {
      const res = await testMutation.mutateAsync();
      if (res.state) apply(res.state);
      setResult({ tone: res.ok ? 'ok' : 'error', text: res.message || (res.ok ? __('Connected.', 'subtleforms') : __('The connection failed.', 'subtleforms')) });
    } catch (e) {
      setResult({ tone: 'error', text: e?.message || __('The connection failed.', 'subtleforms') });
    }
  };

  const disconnect = async () => {
    setResult({ tone: '', text: '' });
    try {
      apply(await disconnectMutation.mutateAsync());
      setEditing(false);
    } catch (e) {
      setResult({ tone: 'error', text: e?.message || __('Could not remove the token.', 'subtleforms') });
    }
  };

  let summary = sprintf(
    /* translators: %s: service name */
    __('Add a %s private app access token to connect this site to your account.', 'subtleforms'),
    label
  );
  if (state.status === 'connected') {
    summary = connectedText(state.account_name);
  } else if (state.status === 'error') {
    summary =
      state.error ||
      sprintf(
        /* translators: %s: service name */
        __('%s did not accept the saved token. Test the connection or change the token.', 'subtleforms'),
        label
      );
  }

  const titleId = `sf-crm-conn-${service}`;

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
            label={__('Access token', 'subtleforms')}
            type='password'
            autoComplete='off'
            value={token}
            onChange={setToken}
            placeholder={ui.placeholder}
            help={ui.tokenHelp || undefined}
          />
          {ui.tokenLink && (
            <p className='sf-em-card__link'>
              <a href={ui.tokenLink} target='_blank' rel='noopener noreferrer'>
                {ui.tokenLinkText}
                <span className='sf-sr-only'> {__('(opens in a new tab)', 'subtleforms')}</span>
              </a>
            </p>
          )}
          <div className='sf-em-card__actions'>
            <Button variant='primary' onClick={save} isBusy={busy === 'save'} disabled={!token.trim() || !!busy}>
              {__('Save and connect', 'subtleforms')}
            </Button>
            {state.has_key && (
              <Button
                variant='tertiary'
                onClick={() => {
                  setEditing(false);
                  setToken('');
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
            <span className='sf-em-card__masked-label'>{__('Access token', 'subtleforms')}</span>
            <span
              className='sf-em-card__masked-value'
              aria-label={sprintf(
                /* translators: %s: last four characters of the saved token */
                __('Saved token ending in %s', 'subtleforms'),
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
              {__('Change token', 'subtleforms')}
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
