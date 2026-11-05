import { useEffect, useMemo, useState } from '@wordpress/element';
import { SelectControl, TextControl, ToggleControl, Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import ExtensionSlot from '../../ExtensionSlot';
import { consentFieldOptions, flattenFields } from '../../builder/utils/integrationFields';
import MappingTable from './MappingTable';
import { StatusBadge } from './ConnectionCard';
import { mailchimpApi, isBuiltInMailchimp } from './api';
import './mailchimp.scss';

const SETTINGS_URL = 'admin.php?page=subtleforms-settings#tab=extensions&ext=mailchimp';

/**
 * Form settings > Integrations > Mailchimp.
 *
 * Settings live in `metadata.integrations.mailchimp`: enabled, list_id,
 * fields { email, first_name, last_name }, merge_fields [ { field, target } ],
 * tags, double_optin, update_existing, consent_field.
 *
 * An add-on may add controls in the `form.integration.mailchimp` slot, which
 * receives { schema, config, patch, isReadOnly, fieldOptions, audienceId,
 * mergeFields }.
 */
export default function MailchimpFormPanel({ schema, integrations = {}, patch, fieldOptions = [], isReadOnly = false }) {
  const config = integrations.mailchimp || {};
  const enabled = !!config.enabled;
  const listId = config.list_id || '';

  const [connection, setConnection] = useState(null);
  const [audiences, setAudiences] = useState(null);
  const [audienceError, setAudienceError] = useState('');
  const [audienceBusy, setAudienceBusy] = useState(false);
  const [merge, setMerge] = useState({ list: '', fields: [], loading: false, error: '' });

  const set = (values) => patch('mailchimp', values);

  const emailOptions = useMemo(
    () => flattenFields(schema?.fields).filter(({ type }) => type === 'email').map(({ key, label }) => ({ label, value: key })),
    [schema?.fields]
  );
  const consentOptions = useMemo(() => consentFieldOptions(schema?.fields), [schema?.fields]);

  // The connection decides whether anything can be loaded.
  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    mailchimpApi
      .state()
      .then((s) => !cancelled && setConnection(s))
      .catch(() => !cancelled && setConnection({ status: 'error', has_key: false }));
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const connected = connection?.has_key === true && connection?.status !== 'error';

  const loadAudiences = (refresh = false) => {
    setAudienceBusy(true);
    setAudienceError('');
    return mailchimpApi
      .audiences(refresh)
      .then((list) => setAudiences(Array.isArray(list) ? list : []))
      .catch((e) => setAudienceError(e?.message || __('Could not load your audiences.', 'subtleforms')))
      .finally(() => setAudienceBusy(false));
  };

  const loadMerge = (id, refresh = false) => {
    if (!id) {
      setMerge({ list: '', fields: [], loading: false, error: '' });
      return Promise.resolve();
    }
    setMerge((m) => ({ ...m, list: id, loading: true, error: '' }));
    return mailchimpApi
      .fields(id, refresh)
      .then((fields) => setMerge({ list: id, fields: Array.isArray(fields) ? fields : [], loading: false, error: '' }))
      .catch((e) => setMerge({ list: id, fields: [], loading: false, error: e?.message || __('Could not load the audience fields.', 'subtleforms') }));
  };

  useEffect(() => {
    if (enabled && connected) loadAudiences(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, connected]);

  useEffect(() => {
    if (enabled && connected) loadMerge(listId, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, connected, listId]);

  if (!isBuiltInMailchimp()) return null;

  const audienceOptions = [
    { label: audiences ? __('Choose an audience', 'subtleforms') : __('Loading audiences…', 'subtleforms'), value: '' },
    ...(audiences || []).map((a) => ({
      label: a.count === null || a.count === undefined ? a.name : `${a.name} (${a.count})`,
      value: a.id,
    })),
  ];
  // A saved audience that the list does not hold (yet) is still shown.
  if (listId && audiences && !audiences.some((a) => a.id === listId)) {
    audienceOptions.push({ label: `${listId}`, value: listId });
  }

  const refresh = () => {
    loadAudiences(true);
    loadMerge(listId, true);
  };

  return (
    <div className='sf-form-settings__integration sf-mc-form'>
      <div className='sf-mc-form__head'>
        <h4 className='sf-form-settings__integration-title'>{__('Mailchimp', 'subtleforms')}</h4>
        {enabled && connection && <StatusBadge status={connection.has_key ? connection.status : 'none'} />}
      </div>
      <ToggleControl
        label={__('Add people who submit this form to Mailchimp', 'subtleforms')}
        checked={enabled}
        onChange={(v) => set({ enabled: v })}
        disabled={isReadOnly}
      />

      {enabled && connection && !connected && (
        <p className='sf-mc-form__notice'>
          {__('Mailchimp is not connected yet. Entries are logged as skipped until it is.', 'subtleforms')}{' '}
          <a href={SETTINGS_URL}>{__('Open Mailchimp settings', 'subtleforms')}</a>
        </p>
      )}

      {enabled && (
        <div className='sf-mc-form__body'>
          <div className='sf-ext-inline'>
            <SelectControl
              label={__('Audience', 'subtleforms')}
              value={listId}
              options={audienceOptions}
              onChange={(v) => set({ list_id: v })}
              disabled={isReadOnly || !connected || audienceBusy}
              help={audienceError || undefined}
            />
            <Button variant='secondary' size='compact' onClick={refresh} disabled={!connected || audienceBusy || isReadOnly}>
              {audienceBusy ? __('Refreshing…', 'subtleforms') : __('Refresh', 'subtleforms')}
            </Button>
          </div>

          <MappingTable
            config={config}
            patch={set}
            fieldOptions={fieldOptions}
            emailOptions={emailOptions}
            mergeFields={listId && merge.list === listId ? merge.fields : []}
            mergeLoading={!!listId && merge.loading}
            mergeError={listId ? merge.error : ''}
            disabled={isReadOnly}
          />

          <TextControl
            label={__('Tags', 'subtleforms')}
            value={config.tags || ''}
            onChange={(v) => set({ tags: v })}
            placeholder={__('For example: website, newsletter', 'subtleforms')}
            help={__('Comma separated. Every person added gets these tags; new tags are created in Mailchimp.', 'subtleforms')}
            disabled={isReadOnly}
          />

          <SelectControl
            label={__('Only subscribe if this box is ticked', 'subtleforms')}
            value={config.consent_field || ''}
            options={[
              { label: __('Always (no consent box)', 'subtleforms'), value: '' },
              ...consentOptions,
            ]}
            onChange={(v) => set({ consent_field: v })}
            help={
              consentOptions.length === 0
                ? __('Add a checkbox or consent field to this form, such as "Yes, send me news", then choose it here. People who leave it unticked are not added.', 'subtleforms')
                : __('Strongly recommended. Only people who tick this box are added, so you have their consent to email them.', 'subtleforms')
            }
            disabled={isReadOnly}
          />

          <ToggleControl
            label={__('Double opt-in', 'subtleforms')}
            checked={!!config.double_optin}
            onChange={(v) => set({ double_optin: v })}
            help={__('New contacts are added as pending and Mailchimp emails them to confirm. People already in the audience are not asked again.', 'subtleforms')}
            disabled={isReadOnly}
          />

          <ToggleControl
            label={__('Update existing contacts', 'subtleforms')}
            checked={config.update_existing === undefined ? true : !!config.update_existing}
            onChange={(v) => set({ update_existing: v })}
            help={__('People already in the audience keep their status (someone who unsubscribed stays unsubscribed) and get their name and other fields updated. Off: people already in the audience are left alone.', 'subtleforms')}
            disabled={isReadOnly}
          />

          <ExtensionSlot
            name='form.integration.mailchimp'
            schema={schema}
            config={config}
            patch={set}
            isReadOnly={isReadOnly}
            fieldOptions={fieldOptions}
            audienceId={listId}
            mergeFields={listId && merge.list === listId ? merge.fields : []}
          />
        </div>
      )}
    </div>
  );
}
