import { useEffect, useMemo, useState } from '@wordpress/element';
import {
  SelectControl,
  TextControl,
  ToggleControl,
  Button,
} from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import apiFetch from '@wordpress/api-fetch';
import Icon from '../../ui/Icon';
import { getSlotItems } from '../../../shared/extend';
import ConnectionTest from '../settings/extensions/ConnectionTest';
import { integrationFieldOptions, consentFieldOptions } from './utils/integrationFields';
import '../settings/extensions/extensions.scss';

const SETTINGS_URL = 'admin.php?page=subtleforms-settings#tab=extensions&ext=';

const PROVIDER_LABELS = {
  mailchimp: 'Mailchimp',
  brevo: 'Brevo',
  convertkit: 'Kit',
  hubspot: 'HubSpot',
  webhook: __('your webhook', 'subtleforms'),
};

const TARGET_LABEL = {
  mailchimp: __('Merge tag, e.g. PHONE', 'subtleforms'),
  brevo: __('Attribute, e.g. SMS', 'subtleforms'),
  convertkit: __('Kit custom field key', 'subtleforms'),
};

/**
 * Editable list of { field, [targetKey] } rows.
 */
function MappingRows({ rows, onChange, fieldOptions, targetKey, targetLabel, targetOptions, disabled }) {
  const list = Array.isArray(rows) ? rows : [];
  const update = (index, patch) => onChange(list.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  return (
    <div className='sf-map'>
      {list.length > 0 && (
        <ul className='sf-map__rows'>
          {list.map((row, index) => (
            <li className='sf-map__row' key={index}>
              <SelectControl
                label={__('Form field', 'subtleforms')}
                hideLabelFromVision
                value={row.field || ''}
                options={[{ label: __('Choose a field', 'subtleforms'), value: '' }, ...fieldOptions]}
                onChange={(v) => update(index, { field: v })}
                disabled={disabled}
              />
              <span className='sf-map__arrow' aria-hidden='true'>→</span>
              {targetOptions ? (
                <SelectControl
                  label={targetLabel}
                  hideLabelFromVision
                  value={row[targetKey] || ''}
                  options={[{ label: targetLabel, value: '' }, ...targetOptions]}
                  onChange={(v) => update(index, { [targetKey]: v })}
                  disabled={disabled}
                />
              ) : (
                <TextControl
                  label={targetLabel}
                  hideLabelFromVision
                  placeholder={targetLabel}
                  value={row[targetKey] || ''}
                  onChange={(v) => update(index, { [targetKey]: v })}
                  disabled={disabled}
                />
              )}
              <Button
                icon={<Icon.Trash size={16} />}
                label={__('Remove', 'subtleforms')}
                size='compact'
                isDestructive
                onClick={() => onChange(list.filter((_, i) => i !== index))}
                disabled={disabled}
              />
            </li>
          ))}
        </ul>
      )}
      <div>
        <Button
          variant='secondary'
          size='compact'
          icon={<Icon.Plus size={14} />}
          onClick={() => onChange([...list, { field: '', [targetKey]: '' }])}
          disabled={disabled}>
          {__('Add field', 'subtleforms')}
        </Button>
      </div>
    </div>
  );
}

/**
 * Email, first name and last name selects.
 */
function IdentityFields({ value = {}, onChange, fieldOptions, disabled, lastNameHelp }) {
  const none = [{ label: __('Not sent', 'subtleforms'), value: '' }];
  const auto = [{ label: __('Detect automatically', 'subtleforms'), value: '' }];
  return (
    <div className='sf-map__grid'>
      <SelectControl
        label={__('Email', 'subtleforms')}
        value={value.email || ''}
        options={[...auto, ...fieldOptions]}
        onChange={(v) => onChange({ ...value, email: v })}
        help={__('Required. Entries without a valid email are skipped.', 'subtleforms')}
        disabled={disabled}
      />
      <SelectControl
        label={__('First name', 'subtleforms')}
        value={value.first_name || ''}
        options={[...auto, ...fieldOptions]}
        onChange={(v) => onChange({ ...value, first_name: v })}
        disabled={disabled}
      />
      <SelectControl
        label={__('Last name', 'subtleforms')}
        value={value.last_name || ''}
        options={[...(lastNameHelp ? none : auto), ...fieldOptions]}
        onChange={(v) => onChange({ ...value, last_name: v })}
        help={lastNameHelp}
        disabled={disabled}
      />
    </div>
  );
}

/**
 * Form builder > Settings > Integrations (2.1).
 *
 * Stores per-form config in metadata.integrations.{email_marketing,crm}. Add-ons
 * add their own sections in the `form.integrations` slot (registerSlotItem or
 * registerFormIntegration).
 */
export default function IntegrationsPanel({ schema, onChange, isReadOnly = false }) {
  const extensions = window.subtleformsAdmin?.extensions ?? {};
  const metadata = schema?.metadata || {};
  const integrations = metadata.integrations || {};

  const shown = ['email_marketing', 'crm'].filter((slug) => extensions[slug]?.available);
  // One slot for every add-on panel, however it was registered
  // (registerSlotItem or registerFormIntegration).
  const slotItems = getSlotItems('form.integrations');
  const legacyWebhookUrl = (integrations.webhooks || {}).url || '';

  const [global, setGlobal] = useState(null);
  const [lists, setLists] = useState(null);
  const [hubspotProps, setHubspotProps] = useState(null);
  // Provider contact fields for the mapping rows (SubtleForms Pro 2.3.0).
  const [emFields, setEmFields] = useState(null);

  const needsSettings = shown.includes('email_marketing') || shown.includes('crm');
  useEffect(() => {
    if (!needsSettings) return;
    let cancelled = false;
    apiFetch({ path: '/subtleforms/v1/settings' })
      .then((res) => {
        if (!cancelled) setGlobal(res?.data ?? res ?? {});
      })
      .catch(() => {
        if (!cancelled) setGlobal({});
      });
    return () => {
      cancelled = true;
    };
  }, [needsSettings]);

  const fieldOptions = useMemo(() => integrationFieldOptions(schema?.fields), [schema?.fields]);
  const consentOptions = useMemo(() => consentFieldOptions(schema?.fields), [schema?.fields]);

  if (shown.length === 0 && slotItems.length === 0 && !legacyWebhookUrl) {
    return (
      <p className='sf-form-settings__intro'>
        {__('No integrations are available yet. Connect one under the plugin’s Settings, then come back to attach it to this form.', 'subtleforms')}
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

  const em = integrations.email_marketing || {};
  const crm = integrations.crm || {};
  const emProvider = global?.ext_email_marketing_provider || 'mailchimp';
  const crmProvider = global?.ext_crm_provider || 'hubspot';

  const notConnected = (slug, label) =>
    !extensions[slug]?.enabled || !extensions[slug]?.configured ? (
      <p className='sf-map__notice'>
        {sprintf(
          /* translators: %s: integration name */
          __('%s is not connected yet. Entries are logged as skipped until it is.', 'subtleforms'),
          label
        )}{' '}
        <a href={`${SETTINGS_URL}${slug}`}>{__('Open settings', 'subtleforms')}</a>
      </p>
    ) : null;

  const listOptions = lists
    ? [
        { label: __('Default from settings', 'subtleforms'), value: '' },
        ...lists.map((l) => ({ label: l.name, value: String(l.id) })),
      ]
    : null;

  return (
    <>
      {/* Email marketing */}
      {shown.includes('email_marketing') && (
        <div className='sf-form-settings__integration'>
          <h4 className='sf-form-settings__integration-title'>{__('Email marketing', 'subtleforms')}</h4>
          <ToggleControl
            label={sprintf(
              /* translators: %s: provider name */
              __('Add people who submit this form to %s', 'subtleforms'),
              PROVIDER_LABELS[emProvider] || PROVIDER_LABELS.mailchimp
            )}
            checked={!!em.enabled}
            onChange={(v) => patch('email_marketing', { enabled: v })}
            disabled={isReadOnly}
          />

          {em.enabled && (
            <div className='sf-map'>
              {notConnected('email_marketing', __('Email marketing', 'subtleforms'))}

              <IdentityFields
                value={em.fields}
                onChange={(fields) => patch('email_marketing', { fields })}
                fieldOptions={fieldOptions}
                disabled={isReadOnly}
                lastNameHelp={
                  emProvider === 'convertkit'
                    ? __('Kit has no last name field: create a custom field with the key last_name first.', 'subtleforms')
                    : undefined
                }
              />

              <SelectControl
                label={__('Only subscribe when', 'subtleforms')}
                value={em.consent_field || ''}
                options={[
                  { label: __('Always (no consent checkbox)', 'subtleforms'), value: '' },
                  ...consentOptions.map((o) => ({
                    value: o.value,
                    label: sprintf(
                      /* translators: %s: field label */
                      __('"%s" is checked', 'subtleforms'),
                      o.label
                    ),
                  })),
                ]}
                onChange={(v) => patch('email_marketing', { consent_field: v })}
                help={__('Use a consent checkbox so only people who agree are added to your list.', 'subtleforms')}
                disabled={isReadOnly}
              />

              <div className='sf-ext-inline'>
                {listOptions ? (
                  <SelectControl
                    label={emProvider === 'convertkit' ? __('Kit form', 'subtleforms') : emProvider === 'brevo' ? __('List', 'subtleforms') : __('Audience', 'subtleforms')}
                    value={em.list_id || ''}
                    options={listOptions}
                    onChange={(v) => patch('email_marketing', { list_id: v })}
                    disabled={isReadOnly}
                  />
                ) : (
                  <TextControl
                    label={emProvider === 'convertkit' ? __('Kit form ID', 'subtleforms') : emProvider === 'brevo' ? __('List ID', 'subtleforms') : __('Audience ID', 'subtleforms')}
                    value={em.list_id || ''}
                    placeholder={__('Default from settings', 'subtleforms')}
                    onChange={(v) => patch('email_marketing', { list_id: v })}
                    disabled={isReadOnly}
                  />
                )}
                <ConnectionTest
                  path='/integrations/email-marketing/test'
                  label={__('Load lists and fields', 'subtleforms')}
                  getBody={() => ({ list_id: em.list_id || '' })}
                  onSuccess={(res) => {
                    setLists(Array.isArray(res.lists) ? res.lists : []);
                    setEmFields(Array.isArray(res.fields) && res.fields.length ? res.fields : null);
                  }}
                  disabled={isReadOnly}
                />
              </div>

              {emProvider !== 'brevo' && (
                <TextControl
                  label={__('Tags', 'subtleforms')}
                  value={em.tags || ''}
                  onChange={(v) => patch('email_marketing', { tags: v })}
                  placeholder={__('e.g. Website, Newsletter', 'subtleforms')}
                  help={
                    emProvider === 'convertkit'
                      ? __('Comma separated. Tags must already exist in Kit.', 'subtleforms')
                      : __('Comma separated. New tags are created in Mailchimp.', 'subtleforms')
                  }
                  disabled={isReadOnly}
                />
              )}

              <p className='sf-map__heading'>{__('Other fields', 'subtleforms')}</p>
              <MappingRows
                rows={em.merge_fields}
                onChange={(rows) => patch('email_marketing', { merge_fields: rows })}
                fieldOptions={fieldOptions}
                targetKey='target'
                targetLabel={TARGET_LABEL[emProvider] || TARGET_LABEL.mailchimp}
                targetOptions={emFields ? emFields.map((f) => ({ label: `${f.label} (${f.id})`, value: f.id })) : null}
                disabled={isReadOnly}
              />

              <div className='sf-map__test'>
                <ConnectionTest
                  path='/integrations/email-marketing/test-contact'
                  label={__('Send test contact', 'subtleforms')}
                  getBody={() => ({ config: em, fields: schema?.fields || [], form_title: metadata.title || metadata.name || '' })}
                  disabled={isReadOnly}
                />
                <p className='sf-map__hint'>
                  {__('Sends a sample contact with your email address through this mapping, so you can check every field arrives.', 'subtleforms')}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CRM */}
      {shown.includes('crm') && (
        <div className='sf-form-settings__integration'>
          <h4 className='sf-form-settings__integration-title'>{__('CRM', 'subtleforms')}</h4>
          <ToggleControl
            label={sprintf(
              /* translators: %s: CRM name */
              __('Send each entry to %s as a contact', 'subtleforms'),
              PROVIDER_LABELS[crmProvider] || 'HubSpot'
            )}
            checked={!!crm.enabled}
            onChange={(v) => patch('crm', { enabled: v })}
            disabled={isReadOnly}
          />

          {crm.enabled && (
            <div className='sf-map'>
              {notConnected('crm', __('The CRM', 'subtleforms'))}

              <IdentityFields
                value={crm.fields}
                onChange={(fields) => patch('crm', { fields })}
                fieldOptions={fieldOptions}
                disabled={isReadOnly}
              />

              <p className='sf-map__heading'>
                {crmProvider === 'hubspot' ? __('HubSpot properties', 'subtleforms') : __('Other properties', 'subtleforms')}
              </p>
              <MappingRows
                rows={crm.properties}
                onChange={(rows) => patch('crm', { properties: rows })}
                fieldOptions={fieldOptions}
                targetKey='property'
                targetLabel={crmProvider === 'hubspot' ? __('Property internal name, e.g. phone', 'subtleforms') : __('Key, e.g. company', 'subtleforms')}
                targetOptions={
                  crmProvider === 'hubspot' && hubspotProps
                    ? hubspotProps.map((p) => ({ label: `${p.label} (${p.name})`, value: p.name }))
                    : null
                }
                disabled={isReadOnly}
              />
              {crmProvider === 'hubspot' && !hubspotProps && (
                <ConnectionTest
                  path='/integrations/crm/test'
                  label={__('Load HubSpot properties', 'subtleforms')}
                  getBody={() => ({ provider: 'hubspot' })}
                  onSuccess={(res) => setHubspotProps(Array.isArray(res.properties) ? res.properties : [])}
                  disabled={isReadOnly}
                />
              )}

              {crmProvider === 'hubspot' && (
                <ToggleControl
                  label={__('Add the answers as a note on the contact', 'subtleforms')}
                  checked={crm.add_note !== undefined ? !!crm.add_note : global?.ext_crm_add_note !== false}
                  onChange={(v) => patch('crm', { add_note: v })}
                  disabled={isReadOnly}
                />
              )}

              <div className='sf-map__test'>
                <ConnectionTest
                  path='/integrations/crm/test-contact'
                  label={__('Send test contact', 'subtleforms')}
                  getBody={() => ({ config: crm, fields: schema?.fields || [], form_title: metadata.title || metadata.name || '' })}
                  disabled={isReadOnly}
                />
                <p className='sf-map__hint'>
                  {__('Sends a sample contact with your email address through this mapping.', 'subtleforms')}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Panels and switches from add-ons such as SubtleForms Pro (form.integrations slot) */}
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
            crmProvider={crmProvider}
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
