import { useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import Icon from '../../ui/Icon';
import { requirePro } from '../../utils/featureGate';
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
function StatusDot({ enabled, configured, available }) {
  if (!available) {
    return (
      <span className='sf-ext-status sf-ext-status--locked' title={__('Pro feature', 'subtleforms')}>
        <Icon.Lock size={12} aria-hidden='true' />
      </span>
    );
  }
  if (enabled && configured) return <span className='sf-ext-status sf-ext-status--active' title={__('Active', 'subtleforms')} />;
  if (enabled) return <span className='sf-ext-status sf-ext-status--warning' title={__('Enabled – needs configuration', 'subtleforms')} />;
  return <span className='sf-ext-status sf-ext-status--inactive' title={__('Disabled', 'subtleforms')} />;
}

/**
 * Pro-lock overlay for unavailable extensions.
 * Minimal inline notice — no blur, no blocking overlay.
 */
function ProLockOverlay({ slug, label }) {
  return (
    <div className='sf-ext-pro-overlay'>
      <span className='sf-ext-pro-overlay__icon' aria-hidden='true'>
        <Icon.Lock size={16} />
      </span>
      <div className='sf-ext-pro-overlay__inner'>
        <p className='sf-ext-pro-overlay__title'>
          {__('Included with SubtleForms Pro', 'subtleforms')}
        </p>
        <p className='sf-ext-pro-overlay__desc'>
          {__('You can look around. Settings unlock as soon as your license is active.', 'subtleforms')}
        </p>
      </div>
      <button
        type='button'
        className='components-button is-primary is-compact sf-ext-pro-overlay__cta'
        onClick={() => requirePro( `extensions.${slug}`, () => {}, { label } )}>
        {__('Unlock', 'subtleforms')}
      </button>
    </div>
  );
}

/**
 * ExtensionsSettings — two-panel layout for the Settings > Extensions tab.
 *
 * @param {Object}   props
 * @param {Object}   props.settings      - Full settings object from useSettingsState
 * @param {Function} props.updateSetting - (key, value) => void
 * @param {Object}   props.fieldErrors   - Per-field validation errors
 */
export default function ExtensionsSettings({ settings, updateSetting, fieldErrors = {} }) {
  const extensions = window.subtleformsAdmin?.extensions ?? {};
  const hashSlug = (window.location.hash.match(/[#&]ext=([\w-]+)/) || [])[1];
  const firstSlug =
    (hashSlug && extensions[hashSlug] ? hashSlug : null) ??
    EXTENSION_ORDER.find((s) => extensions[s]) ??
    EXTENSION_ORDER[0];
  const [activeSlug, setActiveSlug] = useState(firstSlug);

  const ActivePanel = EXTENSION_PANELS[activeSlug] ?? null;
  const activeExt = extensions[activeSlug] ?? {};

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
                  <StatusDot
                    enabled={ext.enabled}
                    configured={ext.configured}
                    available={ext.available}
                  />
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Content */}
      <div className='sf-ext-settings__content'>
        {ActivePanel && (
          <div className='sf-ext-settings__panel-wrap'>
            {!activeExt.available && <ProLockOverlay slug={activeSlug} label={activeExt.label} />}
            <fieldset className='sf-ext-settings__fields' disabled={!activeExt.available}>
            <ActivePanel
              settings={settings}
              updateSetting={updateSetting}
              fieldErrors={fieldErrors}
            />
            </fieldset>
          </div>
        )}
      </div>
    </div>
  );
}
