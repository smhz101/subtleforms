import { ToggleControl, TextControl, SelectControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import FieldError from '../FieldError';
import ConnectionTest from './ConnectionTest';

const PROVIDERS = [
  { label: 'HubSpot', value: 'hubspot' },
  { label: __('Zapier, Make or another webhook', 'subtleforms'), value: 'webhook' },
];

/**
 * CRM Extension Settings Panel
 */
export default function CrmPanel({ settings, updateSetting, fieldErrors = {} }) {
  const provider = settings.ext_crm_provider || 'hubspot';
  const addNote = settings.ext_crm_add_note !== false;

  return (
    <div className='sf-ext-panel'>
      <div className='sf-ext-panel__header'>
        <h2 className='sf-ext-panel__title'>{__('CRM', 'subtleforms')}</h2>
        <p className='sf-ext-panel__description'>
          {__(
            'Create or update a contact for each entry, matched by email address. Connect the CRM here, then switch it on and map fields for each form under Form settings > Integrations.',
            'subtleforms'
          )}
        </p>
      </div>

      <div className='sf-ext-panel__body'>
        <div className='sf-settings-field'>
          <ToggleControl
            label={__('Enable CRM', 'subtleforms')}
            checked={!!settings.ext_crm_enabled}
            onChange={(v) => updateSetting('ext_crm_enabled', v)}
            help={__('Turning this off pauses CRM updates on every form.', 'subtleforms')}
          />
          <FieldError errors={fieldErrors.ext_crm_enabled} />
        </div>

        {settings.ext_crm_enabled && (
          <>
            <div className='sf-settings-field'>
              <SelectControl
                label={__('Send contacts to', 'subtleforms')}
                value={provider}
                options={PROVIDERS}
                onChange={(v) => updateSetting('ext_crm_provider', v)}
                help={
                  provider === 'webhook'
                    ? __('Use this for Salesforce, Pipedrive, Zoho and others through Zapier or Make.', 'subtleforms')
                    : undefined
                }
              />
            </div>

            {provider === 'hubspot' && (
              <>
                <div className='sf-settings-field'>
                  <TextControl
                    label={__('Private app access token', 'subtleforms')}
                    type='password'
                    autoComplete='off'
                    value={settings.ext_crm_api_key || ''}
                    onChange={(v) => updateSetting('ext_crm_api_key', v)}
                    help={__(
                      'In HubSpot: Settings > Integrations > Private apps > Create a private app. Give it the crm.objects.contacts.read and crm.objects.contacts.write scopes, then copy the access token.',
                      'subtleforms'
                    )}
                  />
                  <FieldError errors={fieldErrors.ext_crm_api_key} />
                  <div style={{ marginTop: 12 }}>
                    <ConnectionTest
                      path='/integrations/crm/test'
                      disabled={!settings.ext_crm_api_key}
                      getBody={() => ({ provider: 'hubspot', api_key: settings.ext_crm_api_key || '' })}
                    />
                  </div>
                </div>

                <div className='sf-settings-field'>
                  <TextControl
                    label={__('Hub ID (optional)', 'subtleforms')}
                    value={settings.ext_crm_portal_id || ''}
                    onChange={(v) => updateSetting('ext_crm_portal_id', v)}
                    help={__(
                      'Adds a link to the HubSpot contact in each entry\'s activity log. Shown in HubSpot under your account menu.',
                      'subtleforms'
                    )}
                  />
                  <FieldError errors={fieldErrors.ext_crm_portal_id} />
                </div>

                <div className='sf-settings-field'>
                  <ToggleControl
                    label={__('Add the answers as a note', 'subtleforms')}
                    checked={addNote}
                    onChange={(v) => updateSetting('ext_crm_add_note', v)}
                    help={__(
                      'Adds a note with every answer to the contact\'s timeline. Forms can turn this off.',
                      'subtleforms'
                    )}
                  />
                </div>
              </>
            )}

            {provider === 'webhook' && (
              <div className='sf-settings-field'>
                <TextControl
                  label={__('Webhook URL', 'subtleforms')}
                  type='url'
                  value={settings.ext_crm_webhook_url || ''}
                  onChange={(v) => updateSetting('ext_crm_webhook_url', v)}
                  placeholder='https://hooks.zapier.com/hooks/catch/...'
                  help={__(
                    'Zapier: "Webhooks by Zapier" > Catch Hook. Make: "Webhooks" > Custom webhook. Each entry is posted as JSON with email, first_name, last_name, properties and answers.',
                    'subtleforms'
                  )}
                />
                <FieldError errors={fieldErrors.ext_crm_webhook_url} />
                <div style={{ marginTop: 12 }}>
                  <ConnectionTest
                    path='/integrations/crm/test'
                    label={__('Send a test contact', 'subtleforms')}
                    disabled={!settings.ext_crm_webhook_url}
                    getBody={() => ({ provider: 'webhook', webhook_url: settings.ext_crm_webhook_url || '' })}
                  />
                </div>
              </div>
            )}

            <div className='sf-ext-panel__info'>
              <p className='sf-ext-panel__info-text'>
                {provider === 'hubspot'
                  ? __(
                      'Contacts are matched by email: an existing contact is updated, otherwise one is created. Each form sets which fields fill first name, last name and other HubSpot properties.',
                      'subtleforms'
                    )
                  : __(
                      'Each form sets which fields fill email, first name, last name and any other properties sent to the webhook.',
                      'subtleforms'
                    )}
              </p>
            </div>
          </>
        )}

        {/* SubtleForms Pro: Zapier app connection, API key and Zaps (2.3.0). */}
        {window.SubtleFormsPro?.ZapierPanel && (() => {
          const ZapierPanel = window.SubtleFormsPro.ZapierPanel;
          return <ZapierPanel />;
        })()}
      </div>
    </div>
  );
}
