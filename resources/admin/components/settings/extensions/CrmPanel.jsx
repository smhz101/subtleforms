import { ToggleControl, TextControl, SelectControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import FieldError from '../FieldError';

/**
 * CRM Extension Settings Panel
 */
export default function CrmPanel({ settings, updateSetting, fieldErrors = {} }) {
  const PROVIDERS = [
    { label: 'HubSpot', value: 'hubspot' },
  ];

  return (
    <div className='sf-ext-panel'>
      <div className='sf-ext-panel__header'>
        <h2 className='sf-ext-panel__title'>{__('CRM Integration', 'subtleforms')}</h2>
        <p className='sf-ext-panel__description'>
          {__(
            'Create or update contacts in your CRM automatically when a form is submitted.',
            'subtleforms'
          )}
        </p>
      </div>

      <div className='sf-ext-panel__body'>
        <div className='sf-settings-field'>
          <ToggleControl
            label={__('Enable CRM Integration', 'subtleforms')}
            checked={!!settings.ext_crm_enabled}
            onChange={(v) => updateSetting('ext_crm_enabled', v)}
            help={__('Sync form submissions to your CRM as contacts.', 'subtleforms')}
          />
          <FieldError errors={fieldErrors.ext_crm_enabled} />
        </div>

        {settings.ext_crm_enabled && (
          <>
            <div className='sf-settings-field'>
              <SelectControl
                label={__('CRM Provider', 'subtleforms')}
                value={settings.ext_crm_provider || 'hubspot'}
                options={PROVIDERS}
                onChange={(v) => updateSetting('ext_crm_provider', v)}
              />
            </div>

            <div className='sf-settings-field'>
              <TextControl
                label={__('API Key / Access Token', 'subtleforms')}
                type='password'
                value={settings.ext_crm_api_key || ''}
                onChange={(v) => updateSetting('ext_crm_api_key', v)}
                help={__('Your HubSpot Private App access token.', 'subtleforms')}
              />
              <FieldError errors={fieldErrors.ext_crm_api_key} />
            </div>

            <div className='sf-settings-field'>
              <TextControl
                label={__('Portal ID', 'subtleforms')}
                value={settings.ext_crm_portal_id || ''}
                onChange={(v) => updateSetting('ext_crm_portal_id', v)}
                help={__(
                  'Optional: your HubSpot Hub ID. Found in Account Settings → Account Setup.',
                  'subtleforms'
                )}
              />
              <FieldError errors={fieldErrors.ext_crm_portal_id} />
            </div>

            <div className='sf-ext-panel__info'>
              <p className='sf-ext-panel__info-text'>
                {__(
                  'Fields named "email", "name", "first_name", "last_name", "phone", "company", and "website" are automatically mapped to the HubSpot contact properties.',
                  'subtleforms'
                )}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
