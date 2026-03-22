import { ToggleControl, TextControl, SelectControl, Notice } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import FieldError from '../FieldError';

/**
 * Webhooks Extension Settings Panel
 *
 * @deprecated The Webhooks Extension has been superseded by Form Actions.
 *             This panel is kept so existing settings remain visible and
 *             no data is silently lost. New webhooks should be added via
 *             Form Builder → Settings → Actions.
 */
export default function WebhooksPanel({ settings, updateSetting, fieldErrors = {} }) {
  return (
    <div className='sf-ext-panel sf-ext-panel--deprecated'>
      <div className='sf-ext-panel__header'>
        <h2 className='sf-ext-panel__title'>{__('Webhooks', 'subtleforms')}</h2>
        <p className='sf-ext-panel__description'>
          {__(
            'Send real-time HTTP POST payloads to any external URL when a form is submitted.',
            'subtleforms'
          )}
        </p>
      </div>

      {/* ── Deprecation banner ── */}
      <Notice
        status='warning'
        isDismissible={false}
        className='sf-ext-panel__deprecation-notice'>
        <strong>{__('This extension is deprecated.', 'subtleforms')}</strong>
        {' '}
        {__(
          'Webhook delivery is now configured per-form via Form Builder → Settings → Actions. ' +
          'Existing forms that used the legacy metadata URL will continue to work automatically.',
          'subtleforms'
        )}
      </Notice>

      {/* ── Legacy settings (kept for visibility, no longer active) ── */}
      <div className='sf-ext-panel__body sf-ext-panel__body--muted'>
        <div className='sf-settings-field'>
          <ToggleControl
            label={__('Enable Webhooks (legacy)', 'subtleforms')}
            checked={!!settings.ext_webhooks_enabled}
            onChange={(v) => updateSetting('ext_webhooks_enabled', v)}
            help={__('This setting no longer controls webhook delivery. Use Form Actions instead.', 'subtleforms')}
          />
          <FieldError errors={fieldErrors.ext_webhooks_enabled} />
        </div>

        {settings.ext_webhooks_enabled && (
          <>
            <div className='sf-settings-field'>
              <SelectControl
                label={__('Events (legacy)', 'subtleforms')}
                value={
                  Array.isArray(settings.ext_webhooks_events) &&
                  settings.ext_webhooks_events.includes('submission.created')
                    ? 'submission.created'
                    : ''
                }
                options={[
                  { label: __('Submission Created', 'subtleforms'), value: 'submission.created' },
                ]}
                onChange={(v) => updateSetting('ext_webhooks_events', v ? [v] : [])}
                help={__('No longer used. Retained for reference only.', 'subtleforms')}
              />
              <FieldError errors={fieldErrors.ext_webhooks_events} />
            </div>

            <div className='sf-settings-field'>
              <TextControl
                label={__('Signing Secret (legacy)', 'subtleforms')}
                type='password'
                value={settings.ext_webhooks_signing_secret || ''}
                onChange={(v) => updateSetting('ext_webhooks_signing_secret', v)}
                help={__(
                  'No longer used by the extension. Configure signing per-action in the form builder.',
                  'subtleforms'
                )}
              />
              <FieldError errors={fieldErrors.ext_webhooks_signing_secret} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

