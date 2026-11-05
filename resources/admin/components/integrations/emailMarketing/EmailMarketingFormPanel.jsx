import { useEffect, useMemo, useState } from '@wordpress/element';
import { ToggleControl } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import ExtensionSlot from '../../ExtensionSlot';
import { StatusBadge } from './ServiceConnection';
import { emailMarketingApi, pageData } from './api';
import { uiFor } from './serviceUi';
import { getEmailMarketingServices } from '../../../../shared/extend';
import './registerBuiltins';
import './emailMarketing.scss';

const SETTINGS_URL = 'admin.php?page=subtleforms-settings#tab=extensions&ext=email_marketing';

/**
 * Form settings > Integrations > Email marketing: one section that lists the
 * services switched on in Settings, each with its own on/off switch for this
 * form and the form's settings for it. A service that is off in Settings does
 * not appear; its saved settings stay in the form.
 *
 * Add-ons add options to each service in the `email_marketing.service.form`
 * slot, which receives { service, connected, schema, config, patch,
 * isReadOnly, fieldOptions }.
 *
 * @param {Object}   props
 * @param {Object}   props.schema       Form schema.
 * @param {Object}   props.integrations The form's `metadata.integrations`.
 * @param {Function} props.patch        patch( slug, values ) merges values into `integrations[slug]`.
 * @param {boolean}  props.isReadOnly   Read only.
 * @param {Array}    props.fieldOptions Every field of the form { label, value }.
 */
export default function EmailMarketingFormPanel({ schema, integrations = {}, patch, fieldOptions = [], isReadOnly = false }) {
  const [states, setStates] = useState(() => {
    const map = {};
    Object.entries(pageData().services).forEach(([slug, entry]) => {
      map[slug] = { enabled: !!entry?.enabled, status: entry?.configured ? 'connected' : 'none', has_key: !!entry?.configured, settings: {} };
    });
    return map;
  });

  // The page data is from the time the builder opened; ask again for the switches.
  useEffect(() => {
    let cancelled = false;
    emailMarketingApi
      .all()
      .then((res) => {
        if (cancelled || !res?.services) return;
        setStates((current) => {
          const next = { ...current };
          Object.entries(res.services).forEach(([slug, state]) => {
            next[slug] = state;
          });
          return next;
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const on = useMemo(
    () => getEmailMarketingServices().filter((s) => states[s.slug]?.enabled),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [states]
  );

  return (
    <div className='sf-form-settings__integration sf-em-form'>
      <h4 className='sf-form-settings__integration-title'>{__('Email marketing', 'subtleforms')}</h4>

      {on.length === 0 && (
        <p className='sf-em-form__note'>
          {__('No email marketing service is switched on.', 'subtleforms')}{' '}
          <a href={SETTINGS_URL}>{__('Turn one on in Settings > Integrations > Email marketing', 'subtleforms')}</a>
        </p>
      )}

      {on.map((service) => {
        const state = states[service.slug] || {};
        const connected = state.has_key === true && state.status !== 'error';
        const config = integrations[service.slug] || {};
        const enabled = !!config.enabled;
        const Body = service.formComponent;
        const ui = uiFor(service.slug);
        const set = (values) => patch(service.slug, values);
        const props = { service: service.slug, connected, connection: state, schema, config, patch: set, isReadOnly, fieldOptions };
        return (
          <section className='sf-em-form__service' key={service.slug} data-service={service.slug} aria-label={service.label}>
            <div className='sf-em-form__head'>
              <h5 className='sf-em-form__name'>{service.label}</h5>
              <StatusBadge status={state.has_key ? state.status : 'none'} />
            </div>
            <ToggleControl
              label={ui.switchLabel || sprintf(
                /* translators: %s: service name */
                __('Add people who submit this form to %s', 'subtleforms'),
                service.label
              )}
              checked={enabled}
              onChange={(v) => set({ enabled: v })}
              disabled={isReadOnly}
            />
            {enabled && !connected && (
              <p className="sf-em-form__note">
                {sprintf(
                  /* translators: %s: service name */
                  __('%s is not connected yet. Entries are logged as skipped until it is.', 'subtleforms'),
                  service.label
                )}{' '}
                <a href={`${SETTINGS_URL}&service=${service.slug}`}>{__('Open the settings', 'subtleforms')}</a>
              </p>
            )}
            {enabled && Body && <Body {...props} />}
            {enabled && <ExtensionSlot name='email_marketing.service.form' {...props} />}
          </section>
        );
      })}
    </div>
  );
}
