import { useEffect, useMemo, useState } from '@wordpress/element';
import { SelectControl, TextControl, ToggleControl, Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { consentFieldOptions, flattenFields } from '../../builder/utils/integrationFields';
import MappingTable from './MappingTable';
import { emailMarketingApi } from './api';
import { uiFor } from './serviceUi';
import './emailMarketing.scss';

/**
 * A service's settings for one form (the body below its on/off switch).
 *
 * Settings live in `metadata.integrations.{service}`: enabled, list_id,
 * fields { email, first_name, last_name }, merge_fields [ { field, target } ],
 * tags, double_optin, update_existing, consent_field. The same shape for
 * Mailchimp, MailPoet, Brevo and Kit. MailPoet has no tags and no double opt-in switch;
 * it has send_confirmation_email (default on) and schedule_welcome_email
 * (default off) instead.
 *
 * @param {Object}   props
 * @param {string}   props.service       Service slug.
 * @param {boolean}  props.connected     The service has a working key.
 * @param {Object}   props.connection    Connection state (Brevo: `settings` hold the double opt-in template).
 * @param {Object}   props.schema        Form schema.
 * @param {Object}   props.config        The form's settings for this service.
 * @param {Function} props.patch         patch({ key: value }) on those settings.
 * @param {boolean}  props.isReadOnly    Read only.
 * @param {Array}    props.fieldOptions  Every field of the form { label, value }.
 */
export default function ServiceFormPanel({ service, connected, connection, schema, config = {}, patch, fieldOptions = [], isReadOnly = false }) {
  const ui = uiFor(service);
  const listId = config.list_id || '';
  const mappingKey = ui.upper && service === 'mailchimp' ? listId : '';

  const [lists, setLists] = useState(null);
  const [listError, setListError] = useState('');
  const [listBusy, setListBusy] = useState(false);
  const [fields, setFields] = useState({ key: null, items: [], loading: false, error: '' });

  const emailOptions = useMemo(
    () => flattenFields(schema?.fields).filter(({ type }) => type === 'email').map(({ key, label }) => ({ label, value: key })),
    [schema?.fields]
  );
  const consentOptions = useMemo(() => consentFieldOptions(schema?.fields), [schema?.fields]);

  const loadLists = (refresh = false) => {
    setListBusy(true);
    setListError('');
    return emailMarketingApi
      .lists(service, refresh)
      .then((rows) => setLists(Array.isArray(rows) ? rows : []))
      .catch((e) => setListError(e?.message || ui.listError))
      .finally(() => setListBusy(false));
  };

  const loadFields = (refresh = false) => {
    // Mailchimp fields belong to an audience; Brevo and Kit fields to the account.
    if (service === 'mailchimp' && !listId) {
      setFields({ key: '', items: [], loading: false, error: '' });
      return Promise.resolve();
    }
    setFields((f) => ({ ...f, key: mappingKey, loading: true, error: '' }));
    return emailMarketingApi
      .fields(service, listId, refresh)
      .then((items) => setFields({ key: mappingKey, items: Array.isArray(items) ? items : [], loading: false, error: '' }))
      .catch((e) => setFields({ key: mappingKey, items: [], loading: false, error: e?.message || ui.fieldsError }));
  };

  useEffect(() => {
    if (connected) loadLists(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, service]);

  useEffect(() => {
    if (connected) loadFields(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, service, mappingKey]);

  const set = (values) => patch(values);

  const listOptions = [
    { label: lists ? ui.listChoose : ui.listLoading, value: '' },
    ...(lists || []).map((l) => ({
      label: l.count === null || l.count === undefined ? l.name : `${l.name} (${l.count})`,
      value: String(l.id),
    })),
  ];
  // A saved list that the response does not hold (yet) is still shown.
  if (listId && lists && !lists.some((l) => String(l.id) === listId)) {
    listOptions.push({ label: `${listId}`, value: listId });
  }

  const refresh = () => {
    loadLists(true);
    loadFields(true);
  };

  const fieldsReady = fields.key === mappingKey;
  const doiTemplateSet = !!(connection?.settings?.doi_template_id && connection?.settings?.doi_redirect_url);

  return (
    <div className='sf-em-form__body'>
      <div className='sf-ext-inline'>
        <SelectControl
          label={ui.listLabel}
          value={listId}
          options={listOptions}
          onChange={(v) => set({ list_id: v })}
          disabled={isReadOnly || !connected || listBusy}
          help={listError || undefined}
        />
        <Button variant='secondary' size='compact' onClick={refresh} disabled={!connected || listBusy || isReadOnly}>
          {listBusy ? __('Refreshing…', 'subtleforms') : __('Refresh', 'subtleforms')}
        </Button>
      </div>

      <MappingTable
        service={service}
        config={config}
        patch={set}
        fieldOptions={fieldOptions}
        emailOptions={emailOptions}
        mergeFields={fieldsReady ? fields.items : []}
        mergeLoading={fields.loading}
        mergeError={fieldsReady ? fields.error : ''}
        disabled={isReadOnly}
      />

      {ui.hasTags && (
        <TextControl
          label={__('Tags', 'subtleforms')}
          value={config.tags || ''}
          onChange={(v) => set({ tags: v })}
          placeholder={__('For example: website, newsletter', 'subtleforms')}
          help={ui.tagsHelp}
          disabled={isReadOnly}
        />
      )}

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

      {ui.doi === 'mailpoet' && (
        <>
          <ToggleControl
            label={__('Send MailPoet\'s confirmation email', 'subtleforms')}
            checked={config.send_confirmation_email === undefined ? true : !!config.send_confirmation_email}
            onChange={(v) => set({ send_confirmation_email: v })}
            help={ui.confirmationHelp}
            disabled={isReadOnly}
          />
          <ToggleControl
            label={__('Send the welcome email for this list', 'subtleforms')}
            checked={!!config.schedule_welcome_email}
            onChange={(v) => set({ schedule_welcome_email: v })}
            help={ui.welcomeHelp}
            disabled={isReadOnly}
          />
        </>
      )}
      {ui.doi !== 'none' && ui.doi !== 'mailpoet' && (
        <ToggleControl
          label={__('Double opt-in', 'subtleforms')}
          checked={!!config.double_optin}
          onChange={(v) => set({ double_optin: v })}
          help={ui.doiHelp}
          disabled={isReadOnly}
        />
      )}
      {ui.doi === 'none' && <p className='sf-em-form__note'>{ui.doiHelp}</p>}
      {ui.doi === 'brevo' && !!config.double_optin && connection && !doiTemplateSet && (
        <p className='sf-em-form__note sf-em-form__note--warn'>
          {__('Double opt-in needs a confirmation template and a page for after people confirm.', 'subtleforms')}{' '}
          <a href={`admin.php?page=subtleforms-settings#tab=extensions&ext=email_marketing&service=${service}`}>{__('Set them up', 'subtleforms')}</a>
        </p>
      )}

      {ui.updateExisting !== false && (
        <ToggleControl
          label={__('Update existing contacts', 'subtleforms')}
          checked={config.update_existing === undefined ? true : !!config.update_existing}
          onChange={(v) => set({ update_existing: v })}
          help={ui.updateHelp}
          disabled={isReadOnly}
        />
      )}
    </div>
  );
}
