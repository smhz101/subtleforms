import { useEffect, useMemo, useState } from '@wordpress/element';
import { ToggleControl } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import ExtensionSlot from '../../ExtensionSlot';
import { StatusBadge } from '../emailMarketing/ServiceConnection';
import { crmApi, isConnected, pageData } from './api';
import { getCrmServices } from '../../../../shared/extend';
import './registerBuiltins';
import '../emailMarketing/emailMarketing.scss';

const SETTINGS_URL = 'admin.php?page=subtleforms-settings#tab=extensions&ext=crm';

/**
 * Form settings > Integrations > CRM: the CRMs switched on in Settings, each
 * with its own switch for this form and the form's settings for it. A CRM that
 * is off in Settings does not appear; its saved settings stay in the form.
 *
 * Add-ons add options to each CRM in the `crm.service.form` slot, which
 * receives { service, connected, schema, config, patch, isReadOnly, fieldOptions }.
 *
 * @param {Object}   props
 * @param {Object}   props.schema       Form schema.
 * @param {Object}   props.integrations The form's `metadata.integrations`.
 * @param {Function} props.patch        patch( slug, values ) merges values into `integrations[slug]`.
 * @param {boolean}  props.isReadOnly   Read only.
 * @param {Array}    props.fieldOptions Every field of the form { label, value }.
 */
export default function CrmFormPanel({ schema, integrations = {}, patch, fieldOptions = [], isReadOnly = false }) {
  const [states, setStates] = useState(() => {
    const map = {};
    Object.entries(pageData().services).forEach(([slug, entry]) => {
      map[slug] = { enabled: !!entry?.enabled, status: entry?.configured ? 'connected' : 'none', has_key: !!entry?.configured, connected: !!entry?.configured };
    });
    return map;
  });

  // The page data is from the time the builder opened; ask again for the switches.
  useEffect(() => {
    let cancelled = false;
    crmApi
      .all()
      .then((res) => {
        if (cancelled || !res?.services) return;
        setStates((current) => ({ ...current, ...res.services }));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const on = useMemo(
    () => getCrmServices().filter((s) => states[s.slug]?.enabled),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [states]
  );

  return (
    <div className='sf-form-settings__integration sf-em-form sf-crm-form'>
      <h4 className='sf-form-settings__integration-title'>{__('CRM', 'subtleforms')}</h4>

      {on.length === 0 && (
        <p className='sf-em-form__note'>
          {__('No CRM is switched on.', 'subtleforms')} <a href={SETTINGS_URL}>{__('Turn one on in Settings > Integrations > CRM', 'subtleforms')}</a>
        </p>
      )}

      {on.map((service) => {
        const state = states[service.slug] || {};
        const connected = isConnected(state);
        const config = integrations[service.slug] || {};
        const enabled = !!config.enabled;
        const Body = service.formComponent;
        const set = (values) => patch(service.slug, values);
        const props = { service: service.slug, connected, connection: state, schema, config, patch: set, isReadOnly, fieldOptions };
        return (
          <section className='sf-em-form__service' key={service.slug} data-service={service.slug} aria-label={service.label}>
            <div className='sf-em-form__head'>
              <h5 className='sf-em-form__name'>{service.label}</h5>
              <StatusBadge status={connected ? 'connected' : state.has_key ? state.status : 'none'} />
            </div>
            <ToggleControl
              label={sprintf(
                /* translators: %s: CRM name */
                __('Send people who submit this form to %s', 'subtleforms'),
                service.label
              )}
              checked={enabled}
              onChange={(v) => set({ enabled: v })}
              disabled={isReadOnly}
            />
            {enabled && !connected && (
              <p className='sf-em-form__note'>
                {sprintf(
                  /* translators: %s: CRM name */
                  __('%s is not connected yet. Entries are logged as skipped until it is.', 'subtleforms'),
                  service.label
                )}{' '}
                <a href={`${SETTINGS_URL}&service=${service.slug}`}>{__('Open the settings', 'subtleforms')}</a>
              </p>
            )}
            {enabled && Body && <Body {...props} />}
            {enabled && <ExtensionSlot name='crm.service.form' {...props} />}
          </section>
        );
      })}
    </div>
  );
}
