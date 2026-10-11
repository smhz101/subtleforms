import { useState } from '@wordpress/element';
import { TextControl, SelectControl, Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import FieldError from '../FieldError';
import ConnectionTest from './ConnectionTest';

const RETRIES = [0, 1, 2, 3, 4, 5].map((n) => ({
  value: String(n),
  label:
    n === 0
      ? __('Do not retry', 'subtleforms')
      : [
          __('1 retry (after 1 minute)', 'subtleforms'),
          __('2 retries (1 and 5 minutes)', 'subtleforms'),
          __('3 retries (up to 25 minutes)', 'subtleforms'),
          __('4 retries (up to 2 hours)', 'subtleforms'),
          __('5 retries (up to 10 hours)', 'subtleforms'),
        ][n - 1],
}));

/**
 * Create a random signing secret.
 *
 * @return {string} 40 hex characters.
 */
function randomSecret() {
  const bytes = new Uint8Array(20);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Webhooks Extension Settings Panel
 *
 * Webhooks themselves are form actions (Form settings > Actions). This panel
 * holds the defaults every webhook action uses and a tool to test an endpoint.
 */
export default function WebhooksPanel({ settings, updateSetting, fieldErrors = {} }) {
  const [testUrl, setTestUrl] = useState('');
  const [testMethod, setTestMethod] = useState('POST');
  const retries = String(settings.ext_webhooks_retries ?? 3);

  return (
    <div className='sf-ext-panel'>
      <div className='sf-ext-panel__header'>
        <h2 className='sf-ext-panel__title'>{__('Webhooks', 'subtleforms')}</h2>
        <p className='sf-ext-panel__description'>
          {__(
            'Send each entry as JSON to any URL. Add a webhook to a form under Form settings > Actions; the settings below apply to every webhook action.',
            'subtleforms'
          )}
        </p>
      </div>

      <div className='sf-ext-panel__body'>
        <div className='sf-settings-field'>
          <SelectControl
            label={__('Retry failed deliveries', 'subtleforms')}
            value={retries}
            options={RETRIES}
            onChange={(v) => updateSetting('ext_webhooks_retries', Number(v))}
            help={__(
              'Webhooks are sent in the background, so visitors never wait. When the endpoint is down or answers with an error, SubtleForms tries again with growing gaps. Every attempt is listed in the entry\'s activity log.',
              'subtleforms'
            )}
          />
          <FieldError errors={fieldErrors.ext_webhooks_retries} />
        </div>

        <div className='sf-settings-field'>
          <div className='sf-ext-inline'>
            <TextControl
              label={__('Default signing secret', 'subtleforms')}
              type='password'
              autoComplete='off'
              value={settings.ext_webhooks_signing_secret || ''}
              onChange={(v) => updateSetting('ext_webhooks_signing_secret', v)}
              help={__(
                'Used by webhook actions that have HMAC-SHA256 signing on but no secret of their own. The signature is sent in the X-SubtleForms-Signature header as sha256=HMAC of the body.',
                'subtleforms'
              )}
            />
            <Button
              variant='secondary'
              size='compact'
              onClick={() => updateSetting('ext_webhooks_signing_secret', randomSecret())}>
              {__('Generate', 'subtleforms')}
            </Button>
          </div>
          <FieldError errors={fieldErrors.ext_webhooks_signing_secret} />
        </div>

        <div className='sf-settings-field'>
          <div className='sf-ext-inline'>
            <TextControl
              label={__('Test an endpoint', 'subtleforms')}
              type='url'
              value={testUrl}
              onChange={setTestUrl}
              placeholder='https://example.com/webhook'
              help={__('Sends a sample entry to this URL and shows the response. Nothing is saved.', 'subtleforms')}
            />
            <SelectControl
              label={__('Method', 'subtleforms')}
              value={testMethod}
              options={['POST', 'PUT', 'PATCH'].map((m) => ({ label: m, value: m }))}
              onChange={setTestMethod}
            />
          </div>
          <div style={{ marginTop: 12 }}>
            <ConnectionTest
              path='/integrations/webhooks/test'
              label={__('Send test request', 'subtleforms')}
              disabled={!/^https?:\/\/.+/i.test(testUrl)}
              getBody={() => ({ url: testUrl, method: testMethod, sign: true })}
            />
          </div>
        </div>

        <div className='sf-ext-panel__info'>
          <p className='sf-ext-panel__info-text'>
            {__(
              'The default body contains the form and entry IDs, every answer keyed by field and with its label, and a link to the entry. Choose a custom JSON body, method, headers and signing on each webhook action.',
              'subtleforms'
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
