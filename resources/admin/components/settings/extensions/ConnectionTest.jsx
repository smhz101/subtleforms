import { useState } from '@wordpress/element';
import { Button, Spinner } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import apiFetch from '@wordpress/api-fetch';
import Icon from '../../../ui/Icon';
import './extensions.scss';

/**
 * Call one of the SubtleForms Pro integration test endpoints.
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
 * @param {boolean}  props.requiresPro The route belongs to SubtleForms Pro
 *                                     (webhook tests are part of the free
 *                                     plugin since 2.4.1).
 */
export default function ConnectionTest({
  path,
  getBody,
  onSuccess,
  label = __('Test connection', 'subtleforms'),
  disabled = false,
  requiresPro = true,
}) {
  const [state, setState] = useState({ status: 'idle', message: '' });
  const hasPro = !!window.subtleformsAdmin?.hasProPlugin;

  const run = async () => {
    setState({ status: 'busy', message: '' });
    try {
      const res = await callIntegration(path, getBody ? getBody() : {});
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
          requiresPro && error?.code === 'rest_no_route'
            ? __('Connection tests need SubtleForms Pro to be active.', 'subtleforms')
            : error?.message || __('The connection failed.', 'subtleforms'),
      });
    }
  };

  return (
    <div className='sf-conn-test'>
      <Button
        variant='secondary'
        size='compact'
        onClick={run}
        disabled={disabled || (requiresPro && !hasPro) || state.status === 'busy'}
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
