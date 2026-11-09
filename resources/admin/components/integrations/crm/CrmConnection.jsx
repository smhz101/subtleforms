import { useState } from '@wordpress/element';
import { Button, TextControl } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import Icon from '../../../ui/Icon';
import { StatusBadge } from '../emailMarketing/ServiceConnection';
import ConnectionSteps from '../ConnectionSteps';
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
 * The connection of one CRM: service key, test and status.
 *
 * The saved key is never shown. A saved key appears as a masked line with
 * its last four characters and a "Change key" button. Disconnect removes the
 * key; the switch and each form's settings stay. Like Email marketing, every
 * action here applies at once, so there is no Save button in the section.
 *
 * @param {Object}   props
 * @param {string}   props.service Service slug.
 * @param {string}   props.label   Service name.
 * @param {Object}   props.state   Connection state from the server.
 * @param {Function} props.onState Called with the new state after every change.
 * @param {Object}   props.ui      { fieldLabel, placeholder, tokenHelp, stepsTitle, steps }. `steps` is a function that returns the props of ConnectionSteps.
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
      setResult({ tone: 'error', text: e?.message || __('Could not remove the key.', 'subtleforms') });
    }
  };

  let summary = sprintf(
    /* translators: %s: service name */
    __('Add a %s service key to connect this site to your account.', 'subtleforms'),
    label
  );
  if (state.status === 'connected') {
    summary = connectedText(state.account_name);
  } else if (state.status === 'error') {
    summary =
      state.error ||
      sprintf(
        /* translators: %s: service name */
        __('%s did not accept the saved key. Test the connection or change the key.', 'subtleforms'),
        label
      );
  }

  const titleId = `sf-crm-conn-${service}`;
  const fieldLabel = ui.fieldLabel || __('Service key', 'subtleforms');
  const guide = typeof ui.steps === 'function' ? ui.steps() : null;

  return (
    <section className='sf-em-card' aria-labelledby={titleId}>
      <header className='sf-em-card__head'>
        <h3 id={titleId} className='sf-em-card__title'>
          {__('Connection', 'subtleforms')}
        </h3>
        <StatusBadge status={state.status} />
      </header>
      {!(result.text && result.tone === 'ok') && <p className='sf-em-card__summary'>{summary}</p>}

      {showField && guide && <ConnectionSteps id={`sf-steps-${service}`} title={ui.stepsTitle} defaultOpen={state.status !== 'connected'} {...guide} />}

      {showField ? (
        <div className='sf-em-card__key'>
          <TextControl
            label={fieldLabel}
            type='password'
            autoComplete='off'
            value={token}
            onChange={setToken}
            placeholder={ui.placeholder}
            help={ui.tokenHelp || undefined}
          />
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
            <span className='sf-em-card__masked-label'>{fieldLabel}</span>
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

      {!showField && guide && (
        <ConnectionSteps id={`sf-steps-${service}`} title={ui.stepsTitle} defaultOpen={false} {...guide} />
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
