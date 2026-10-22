import { useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import WebhooksPanel from './extensions/WebhooksPanel';
import EmailMarketingPanel from './extensions/EmailMarketingPanel';
import CrmPanel from './extensions/CrmPanel';
import EcommercePanel from './extensions/EcommercePanel';
import PdfPanel from './extensions/PdfPanel';
import MultilanguagePanel from './extensions/MultilanguagePanel';
import PaymentsPanel from './extensions/PaymentsPanel';
import { getSlotItems } from '../../../shared/extend';

// Panels add-ons bring are registered in the `settings.extensions` slot with
// the integration slug as id (form analytics is one, from SubtleForms Pro).
const EXTENSION_PANELS = {
  webhooks: WebhooksPanel,
  email_marketing: EmailMarketingPanel,
  crm: CrmPanel,
  ecommerce: EcommercePanel,
  pdf: PdfPanel,
  multilanguage: MultilanguagePanel,
  payments: PaymentsPanel,
};

// Ordered list of extensions to display in the sidebar.
const EXTENSION_ORDER = [
  'webhooks',
  'email_marketing',
  'crm',
  'analytics',
  'ecommerce',
  'pdf',
  'multilanguage',
  'payments',
];

/**
 * Live status of an integration from the settings being edited (PRO-30), so
 * the dot changes as soon as a switch or a key changes, not after a reload.
 *
 * @param {string} slug     Integration slug.
 * @param {Object} ext      Status from page load.
 * @param {Object} settings Current settings.
 * @return {{enabled: boolean, configured: boolean}} Status.
 */
export function extensionStatus(slug, ext, settings = {}) {
  const has = (key) => !!(settings[key] !== undefined ? settings[key] : null);
  let enabled = !!ext?.enabled;
  if (['email_marketing', 'crm', 'multilanguage', 'payments'].includes(slug) && settings[`ext_${slug}_enabled`] !== undefined) {
    enabled = !!settings[`ext_${slug}_enabled`] && ext?.available !== false;
  }
  let configured = !!ext?.configured;
  if (slug === 'email_marketing' && settings.ext_email_marketing_api_key !== undefined) {
    configured = has('ext_email_marketing_api_key');
  } else if (slug === 'crm' && settings.ext_crm_provider !== undefined) {
    configured = has(settings.ext_crm_provider === 'webhook' ? 'ext_crm_webhook_url' : 'ext_crm_api_key');
  } else if (slug === 'payments' && settings.ext_payments_stripe_pk !== undefined) {
    configured = has('ext_payments_stripe_pk');
  } else if (['webhooks', 'ecommerce', 'pdf', 'multilanguage'].includes(slug)) {
    configured = true;
  }
  return { enabled, configured };
}

/**
 * Extension status dot
 */
function StatusDot({ enabled, configured }) {
  if (enabled && configured) return <span className='sf-ext-status sf-ext-status--active' title={__('Active', 'subtleforms')} />;
  if (enabled) return <span className='sf-ext-status sf-ext-status--warning' title={__('Enabled, needs configuration', 'subtleforms')} />;
  return <span className='sf-ext-status sf-ext-status--inactive' title={__('Disabled', 'subtleforms')} />;
}

/**
 * ExtensionsSettings, two-panel layout for the Settings > Extensions tab.
 *
 * @param {Object}   props
 * @param {Object}   props.settings      - Full settings object from useSettingsState
 * @param {Function} props.updateSetting - (key, value) => void
 * @param {Object}   props.fieldErrors   - Per-field validation errors
 */
export default function ExtensionsSettings({ settings, updateSetting, fieldErrors = {} }) {
  // Only integrations this site can use are listed. SubtleForms Pro adds
  // its own (email marketing, CRM, WooCommerce, PDF, translation, payments).
  const allExtensions = window.subtleformsAdmin?.extensions ?? {};
  // Integrations the plan does not include are listed with the plan that has
  // them (PRO-08), when SubtleForms Pro says which one.
  const extensions = Object.fromEntries(
    Object.entries(allExtensions).filter(([, ext]) => ext && (ext.available || ext.requires))
  );
  const hideUpgrade = !!window.subtleformsAdmin?.branding?.hideUpgrade;
  const hasPro = !!window.subtleformsAdmin?.hasProPlugin;
  const hashSlug = (window.location.hash.match(/[#&]ext=([\w-]+)/) || [])[1];
  const firstSlug =
    (hashSlug && extensions[hashSlug] ? hashSlug : null) ??
    EXTENSION_ORDER.find((s) => extensions[s]) ??
    EXTENSION_ORDER[0];
  const [activeSlug, setActiveSlug] = useState(firstSlug);

  const ActivePanel =
    EXTENSION_PANELS[activeSlug] ??
    getSlotItems('settings.extensions').find((item) => item.id === activeSlug)?.component ??
    null;

  return (
    <div className='sf-ext-settings'>
      {/* Sidebar */}
      <nav className='sf-ext-settings__sidebar'>
        <ul className='sf-ext-settings__list'>
          {EXTENSION_ORDER.map((slug) => {
            const ext = extensions[slug];
            if (!ext) return null;
            return (
              <li key={slug}>
                <button
                  type='button'
                  className={`sf-ext-settings__item ${
                    activeSlug === slug ? 'sf-ext-settings__item--active' : ''
                  }`}
                  aria-current={activeSlug === slug ? 'true' : undefined}
                  onClick={() => {
                    setActiveSlug(slug);
                    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
                    params.set('ext', slug);
                    window.history.replaceState(null, '', `#${params.toString()}`);
                  }}>
                  <span className='sf-ext-settings__item-label'>{ext.label}</span>
                  {ext.available ? (
                    <StatusDot {...extensionStatus(slug, ext, settings)} />
                  ) : (
                    <span className='sf-ext-settings__item-plan'>
                      {
                        /* translators: %s: plan name, for example Agency */
                        sprintf(__('Needs %s', 'subtleforms'), ext.requires)
                      }
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
        {!hasPro && (
          <p className='sf-ext-settings__more'>
            {__('SubtleForms Pro adds Mailchimp, Brevo, HubSpot, WooCommerce, entry PDFs, WPML and Polylang, and Stripe.', 'subtleforms')}{' '}
            <a href='https://subtleforms.com/pricing/' target='_blank' rel='noopener noreferrer'>
              {__('About SubtleForms Pro', 'subtleforms')}
            </a>
          </p>
        )}
      </nav>

      {/* Content */}
      <div className='sf-ext-settings__content'>
        {extensions[activeSlug] && !extensions[activeSlug].available && (
          <div className='sf-ext-settings__panel-wrap sf-ext-settings__locked'>
            <h3>{extensions[activeSlug].label}</h3>
            <p>{extensions[activeSlug].description}</p>
            <p>
              {sprintf(
                /* translators: %s: plan name, for example Agency */
                __('Included with the %s plan. Your license does not include it.', 'subtleforms'),
                extensions[activeSlug].requires
              )}
            </p>
            {!hideUpgrade && (
              <a className='components-button is-secondary' href='https://subtleforms.com/pricing/' target='_blank' rel='noopener noreferrer'>
                {__('Compare plans', 'subtleforms')}
              </a>
            )}
          </div>
        )}
        {ActivePanel && extensions[activeSlug]?.available && (
          <div className='sf-ext-settings__panel-wrap'>
            <ActivePanel
              settings={settings}
              updateSetting={updateSetting}
              fieldErrors={fieldErrors}
            />
          </div>
        )}
      </div>
    </div>
  );
}
