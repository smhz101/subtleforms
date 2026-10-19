import { useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import WebhooksPanel from './extensions/WebhooksPanel';
import EmailMarketingPanel from './extensions/EmailMarketingPanel';
import CrmPanel from './extensions/CrmPanel';
import AnalyticsPanel from './extensions/AnalyticsPanel';
import EcommercePanel from './extensions/EcommercePanel';
import PdfPanel from './extensions/PdfPanel';
import MultilanguagePanel from './extensions/MultilanguagePanel';
import PaymentsPanel from './extensions/PaymentsPanel';

const EXTENSION_PANELS = {
  webhooks: WebhooksPanel,
  email_marketing: EmailMarketingPanel,
  crm: CrmPanel,
  analytics: AnalyticsPanel,
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
  const extensions = Object.fromEntries(
    Object.entries(allExtensions).filter(([, ext]) => ext && ext.available)
  );
  const hasPro = !!window.subtleformsAdmin?.hasProPlugin;
  const hashSlug = (window.location.hash.match(/[#&]ext=([\w-]+)/) || [])[1];
  const firstSlug =
    (hashSlug && extensions[hashSlug] ? hashSlug : null) ??
    EXTENSION_ORDER.find((s) => extensions[s]) ??
    EXTENSION_ORDER[0];
  const [activeSlug, setActiveSlug] = useState(firstSlug);

  const ActivePanel = EXTENSION_PANELS[activeSlug] ?? null;

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
                  <StatusDot enabled={ext.enabled} configured={ext.configured} />
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
        {ActivePanel && (
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
