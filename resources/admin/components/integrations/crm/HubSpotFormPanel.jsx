import { useEffect, useMemo, useState } from '@wordpress/element';
import { Button, SelectControl, ToggleControl } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { consentFieldOptions, flattenFields } from '../../builder/utils/integrationFields';
import { fetchProperties } from './queries';
import '../emailMarketing/emailMarketing.scss';

const IDENTITY_ROWS = [
  { key: 'first_name', label: __('First name', 'subtleforms') },
  { key: 'last_name', label: __('Last name', 'subtleforms') },
  { key: 'phone', label: __('Phone number', 'subtleforms') },
  { key: 'company', label: __('Company name', 'subtleforms') },
];

/**
 * Set the form field for a HubSpot property, keeping the other rows (and their
 * order). An empty field removes the row.
 *
 * @param {Array}  rows     Rows { field, property }.
 * @param {string} property HubSpot property name.
 * @param {string} field    Form field key, or '' to remove.
 * @return {Array} New rows.
 */
export function setPropertyRow(rows, property, field) {
  const list = Array.isArray(rows) ? rows : [];
  const same = (r) => r.property === property;
  if (!field) return list.filter((r) => !same(r));
  if (!list.some(same)) return [...list, { field, property }];
  return list.map((r) => (same(r) ? { ...r, field } : r));
}

/**
 * HubSpot's settings for one form (the body below its switch).
 *
 * Settings live in `metadata.integrations.hubspot`: enabled, fields { email,
 * first_name, last_name, phone, company }, properties [ { field, property } ],
 * update_existing (default on) and consent_field.
 *
 * @param {Object}   props
 * @param {boolean}  props.connected    HubSpot has a working token.
 * @param {Object}   props.schema       Form schema.
 * @param {Object}   props.config       The form's settings for HubSpot.
 * @param {Function} props.patch        patch({ key: value }) on those settings.
 * @param {boolean}  props.isReadOnly   Read only.
 * @param {Array}    props.fieldOptions Every field of the form { label, value }.
 */
export default function HubSpotFormPanel({ connected, schema, config = {}, patch, fieldOptions = [], isReadOnly = false }) {
  const client = useQueryClient();
  const [props, setProps] = useState({ items: [], loading: false, error: '' });
  const fields = config.fields || {};
  const rows = Array.isArray(config.properties) ? config.properties : [];

  const emailOptions = useMemo(
    () => flattenFields(schema?.fields).filter(({ type }) => type === 'email').map(({ key, label }) => ({ label, value: key })),
    [schema?.fields]
  );
  const consentOptions = useMemo(() => consentFieldOptions(schema?.fields), [schema?.fields]);

  const load = (refresh = false) => {
    setProps((p) => ({ ...p, loading: true, error: '' }));
    return fetchProperties(client, 'hubspot', refresh)
      .then((items) => setProps({ items: Array.isArray(items) ? items : [], loading: false, error: '' }))
      .catch((e) => setProps({ items: [], loading: false, error: e?.message || __('Could not load the HubSpot properties.', 'subtleforms') }));
  };

  useEffect(() => {
    if (connected) load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);

  const setIdentity = (name, value) => patch({ fields: { ...fields, [name]: value } });
  const auto = (label) => [{ label, value: '' }];
  const notSent = [{ label: __('Not sent', 'subtleforms'), value: '' }];

  // Properties already used by the fixed rows are not offered twice.
  const reserved = new Set(['email', 'firstname', 'lastname', 'phone', 'company']);
  const known = new Set(props.items.map((p) => p.name));
  const custom = props.items.filter((p) => !reserved.has(p.name));
  const orphans = rows.filter((r) => r.property && !known.has(r.property));

  return (
    <div className='sf-em-form__body'>
      <div className='sf-em-map' role='group' aria-label={__('Field mapping', 'subtleforms')}>
        <div className='sf-em-map__head' aria-hidden='true'>
          <span>{__('HubSpot property', 'subtleforms')}</span>
          <span>{__('Form field', 'subtleforms')}</span>
        </div>

        <div className='sf-em-map__row'>
          <span className='sf-em-map__target'>
            {__('Email', 'subtleforms')} <em>{__('required', 'subtleforms')}</em>
          </span>
          <SelectControl
            label={__('Form field for Email', 'subtleforms')}
            hideLabelFromVision
            value={fields.email || ''}
            options={[...auto(__('First email field in the form', 'subtleforms')), ...emailOptions]}
            onChange={(v) => setIdentity('email', v)}
            disabled={isReadOnly}
            help={emailOptions.length === 0 ? __('This form has no Email field. Add one so contacts can be sent.', 'subtleforms') : undefined}
          />
        </div>

        {IDENTITY_ROWS.map((row) => (
          <div className='sf-em-map__row' key={row.key}>
            <span className='sf-em-map__target'>{row.label}</span>
            <SelectControl
              label={sprintf(
                /* translators: %s: HubSpot property name */
                __('Form field for %s', 'subtleforms'),
                row.label
              )}
              hideLabelFromVision
              value={fields[row.key] || ''}
              options={[...auto(row.key === 'first_name' || row.key === 'last_name' ? __('Detect automatically', 'subtleforms') : __('Not sent', 'subtleforms')), ...fieldOptions]}
              onChange={(v) => setIdentity(row.key, v)}
              disabled={isReadOnly}
            />
          </div>
        ))}

        {custom.map((p) => (
          <div className='sf-em-map__row' key={p.name}>
            <span className='sf-em-map__target'>
              {p.label || p.name} <code>{p.name}</code>
            </span>
            <SelectControl
              label={sprintf(
                /* translators: %s: HubSpot property name */
                __('Form field for %s', 'subtleforms'),
                p.label || p.name
              )}
              hideLabelFromVision
              value={rows.find((r) => r.property === p.name)?.field || ''}
              options={[...notSent, ...fieldOptions]}
              onChange={(v) => patch({ properties: setPropertyRow(rows, p.name, v) })}
              disabled={isReadOnly}
            />
          </div>
        ))}

        {orphans.map((r) => (
          <div className='sf-em-map__row sf-em-map__row--orphan' key={`orphan-${r.property}`}>
            <span className='sf-em-map__target'>
              <code>{r.property}</code> <em>{props.loading || props.error ? __('saved', 'subtleforms') : __('not found', 'subtleforms')}</em>
            </span>
            <div className='sf-em-map__orphan-control'>
              <SelectControl
                label={sprintf(
                  /* translators: %s: HubSpot property name */
                  __('Form field for %s', 'subtleforms'),
                  r.property
                )}
                hideLabelFromVision
                value={r.field || ''}
                options={[...notSent, ...fieldOptions]}
                onChange={(v) => patch({ properties: setPropertyRow(rows, r.property, v) })}
                disabled={isReadOnly}
              />
              {!isReadOnly && (
                <Button variant='tertiary' size='compact' isDestructive onClick={() => patch({ properties: setPropertyRow(rows, r.property, '') })}>
                  {__('Remove', 'subtleforms')}
                </Button>
              )}
            </div>
          </div>
        ))}

        {props.loading && (
          <p className='sf-em-map__note' role='status'>
            {__('Loading the HubSpot properties…', 'subtleforms')}
          </p>
        )}
        {props.error && <p className='sf-em-map__note sf-em-map__note--error'>{props.error}</p>}
        {!props.loading && !props.error && custom.length === 0 && (
          <p className='sf-em-map__note'>{__('Your HubSpot contact properties appear here once HubSpot is connected.', 'subtleforms')}</p>
        )}
        {connected && !isReadOnly && (
          <Button variant='secondary' size='compact' onClick={() => load(true)} disabled={props.loading}>
            {props.loading ? __('Refreshing…', 'subtleforms') : __('Refresh properties', 'subtleforms')}
          </Button>
        )}
      </div>

      <SelectControl
        label={__('Only send if this box is ticked', 'subtleforms')}
        value={config.consent_field || ''}
        options={[...auto(__('Always (no consent box)', 'subtleforms')), ...consentOptions]}
        onChange={(v) => patch({ consent_field: v })}
        help={
          consentOptions.length === 0
            ? __('Add a checkbox or consent field to this form, then choose it here. People who leave it unticked are not sent to HubSpot.', 'subtleforms')
            : __('Strongly recommended. Only people who tick this box are sent, so you have their consent to contact them.', 'subtleforms')
        }
        disabled={isReadOnly}
      />

      <ToggleControl
        label={__('Update existing contacts', 'subtleforms')}
        checked={config.update_existing === undefined ? true : !!config.update_existing}
        onChange={(v) => patch({ update_existing: v })}
        help={__('When the email is already a contact, update it. When off, existing contacts are left as they are.', 'subtleforms')}
        disabled={isReadOnly}
      />
    </div>
  );
}
