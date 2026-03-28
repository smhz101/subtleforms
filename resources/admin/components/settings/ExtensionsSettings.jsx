import { useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import Icon from '../ui/Icon';
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
  if (!available) return <span className='sf-ext-status sf-ext-status--locked' title={__('Pro feature', 'subtleforms')}>🔒</span>;
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
      <div className='sf-ext-pro-overlay__inner'>
        <Icon.Lock size={24} className='sf-ext-pro-overlay__icon' />
        <h3 className='sf-ext-pro-overlay__title'>{__('Pro feature', 'subtleforms')}</h3>
        <p className='sf-ext-pro-overlay__desc'>
          {__('Upgrade your plan to configure this extension.', 'subtleforms')}
        </p>
        <button
          type='button'
          className='sf-ext-pro-overlay__cta'
          onClick={() => requirePro( `extensions.${slug}`, () => {}, { label } )}>
          {__('Upgrade to Pro', 'subtleforms')}
        </button>
      </div>
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
  const firstSlug = EXTENSION_ORDER.find((s) => extensions[s]) ?? EXTENSION_ORDER[0];
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
                  onClick={() => setActiveSlug(slug)}>
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
