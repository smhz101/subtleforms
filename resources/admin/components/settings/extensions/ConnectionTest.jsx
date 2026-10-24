import { useState } from '@wordpress/element';
import { Button, Spinner } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import apiFetch from '@wordpress/api-fetch';
import Icon from '../../../ui/Icon';
import './extensions.scss';

/**
 * Call an integration test endpoint.
 *
 * @param {string} path REST path under /subtleforms/v1.
 * @param {Object} data Request body.
 * @return {Promise<Object>} Response body.
 */
export function callIntegration(path, data) {
  return apiFetch({
    path: `/subtleforms/v1${path}`,
    method: 'POST',
    data,
  });
}

/**
 * "Test connection" button with an inline result line.
 *
 * @param {Object}   props
 * @param {string}   props.path      REST path, e.g. /integrations/crm/test.
 * @param {Function} props.getBody   Returns the request body at click time.
 * @param {Function} props.onSuccess Receives the response body.
 * @param {string}   props.label     Button label.
 * @param {boolean}  props.disabled  Disable the button.
 * @param {boolean}  props.addonRoute The route belongs to an add-on (webhook
 *                                    tests are part of this plugin).
 */
export default function ConnectionTest({
  path,
  getBody,
  onSuccess,
  label = __('Test connection', 'subtleforms'),
  disabled = false,
  addonRoute = true,
}) {
  const [state, setState] = useState({ status: 'idle', message: '' });

  const run = async () => {
    setState({ status: 'busy', message: '' });
    try {
      const raw = await callIntegration(path, getBody ? getBody() : {});
      // This plugin's routes answer in the { data } envelope; add-on routes may answer flat.
      const res = raw && typeof raw === 'object' && !('ok' in raw) && raw.data && typeof raw.data === 'object' ? raw.data : raw;
      const ok = res?.ok !== false;
      setState({
        status: ok ? 'ok' : 'error',
        message: res?.message || (ok ? __('Connected.', 'subtleforms') : __('The connection failed.', 'subtleforms')),
      });
      if (ok && onSuccess) {
        onSuccess(res);
      }
    } catch (error) {
      setState({
        status: 'error',
        message:
          addonRoute && error?.code === 'rest_no_route'
            ? __('This test is provided by an add-on that is not active.', 'subtleforms')
            : error?.error?.message || error?.message || __('The connection failed.', 'subtleforms'),
      });
    }
  };

  return (
    <div className='sf-conn-test'>
      <Button
        variant='secondary'
        size='compact'
        onClick={run}
        disabled={disabled || state.status === 'busy'}
        aria-describedby={state.message ? `${path}-result` : undefined}>
        {state.status === 'busy' ? <Spinner /> : null}
        {label}
      </Button>
      {state.message && (
        <p
          id={`${path}-result`}
          role='status'
          className={`sf-conn-test__result sf-conn-test__result--${state.status}`}>
          {state.status === 'ok' ? (
            <Icon.CheckCircle size={14} aria-hidden='true' />
          ) : (
            <Icon.AlertCircle size={14} aria-hidden='true' />
          )}
          <span>{state.message}</span>
        </p>
      )}
    </div>
  );
}
