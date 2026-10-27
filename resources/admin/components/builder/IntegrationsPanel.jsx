import { useMemo } from '@wordpress/element';
import { TextControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { getSlotItems } from '../../../shared/extend';
import { integrationFieldOptions } from './utils/integrationFields';
import '../settings/extensions/extensions.scss';

/**
 * Form builder > Settings > Integrations (2.1).
 *
 * Add-ons add their own sections in the `form.integrations` slot
 * (registerSlotItem or registerFormIntegration) and keep their settings in
 * metadata.integrations.{slug}. The legacy per-form webhook URL is shown here
 * while a form still has one.
 */
export default function IntegrationsPanel({ schema, onChange, isReadOnly = false }) {
  const metadata = schema?.metadata || {};
  const integrations = metadata.integrations || {};

  // One slot for every add-on panel, however it was registered
  // (registerSlotItem or registerFormIntegration).
  const slotItems = getSlotItems('form.integrations');
  const legacyWebhookUrl = (integrations.webhooks || {}).url || '';

  const fieldOptions = useMemo(() => integrationFieldOptions(schema?.fields), [schema?.fields]);

  if (slotItems.length === 0 && !legacyWebhookUrl) {
    return (
      <p className='sf-form-settings__intro'>
        {__('Send entries to other services with webhooks. Add a Webhook action under Notifications. Defaults for every webhook are under Settings > Integrations.', 'subtleforms')}
      </p>
    );
  }

  const patch = (slug, values) => {
    if (isReadOnly) return;
    onChange({
      ...schema,
      metadata: {
        ...metadata,
        integrations: {
          ...integrations,
          [slug]: { ...(integrations[slug] || {}), ...values },
        },
      },
    });
  };

  return (
    <>
      {/* Panels and switches from add-ons (form.integrations slot) */}
      {slotItems.map((item) => {
        const Slot = item.component;
        return (
          <Slot
            key={item.id}
            schema={schema}
            integrations={integrations}
            onChange={onChange}
            patch={patch}
            isReadOnly={isReadOnly}
            fieldOptions={fieldOptions}
          />
        );
      })}

      {/* Legacy per-form webhook URL (pre 1.9). Shown only when set. */}
      {legacyWebhookUrl && (
        <div className='sf-form-settings__integration'>
          <h4 className='sf-form-settings__integration-title'>{__('Legacy webhook', 'subtleforms')}</h4>
          <TextControl
            label={__('Webhook URL', 'subtleforms')}
            value={legacyWebhookUrl}
            onChange={(v) => patch('webhooks', { url: v })}
            help={__(
              'Kept from an older version and still sent. Add a Webhook action under Actions instead for headers, signing and retries, then clear this field.',
              'subtleforms'
            )}
            disabled={isReadOnly}
          />
        </div>
      )}
    </>
  );
}
