import { useEffect, useReducer, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import WebhooksPanel from './extensions/WebhooksPanel';
import EmailMarketingSettings from '../integrations/emailMarketing/EmailMarketingSettings';
import { getSlotItems } from '../../../shared/extend';

// Panels add-ons bring are registered in the `settings.extensions` slot with
// the integration slug as id. Webhooks and Email marketing are the panels this
// plugin ships. The Email marketing panel is drawn only while the integration
// list carries this plugin's own entry (`builtin`); an add-on that lists its
// own `email_marketing` entry draws its panel from the slot instead.
const EXTENSION_PANELS = {
  webhooks: WebhooksPanel,
};
const BUILT_IN_WHEN_LISTED = {
  email_marketing: EmailMarketingSettings,
};

/**
 * The panel for an integration slug, or null when nothing provides one.
 *
 * @param {string}      slug Integration slug.
 * @param {Object|null} ext  The integration's entry in the list.
 * @return {Function|null} Component.
 */
function panelFor(slug, ext = null) {
  if (BUILT_IN_WHEN_LISTED[slug]) {
    return ext?.builtin === true
      ? BUILT_IN_WHEN_LISTED[slug]
      : getSlotItems('settings.extensions').find((item) => item.id === slug)?.component ?? null;
  }
  return (
    EXTENSION_PANELS[slug] ??
    getSlotItems('settings.extensions').find((item) => item.id === slug)?.component ??
    null
  );
}

/**
 * Slugs to list in the sidebar: Webhooks, Email marketing, then what an add-on lists.
 * An entry is shown only when it is available and something draws its panel.
 *
 * @param {Object} extensions Integrations by slug.
 * @return {string[]} Slugs.
 */
export function listedExtensions(extensions) {
  const rank = (slug) => (slug === 'webhooks' ? 0 : slug === 'email_marketing' ? 1 : 2);
  const slugs = Object.keys(extensions).sort((a, b) => rank(a) - rank(b));
  return slugs.filter((slug) => {
    const ext = extensions[slug];
    return !!ext && ext.available !== false && !!panelFor(slug, ext);
  });
}

/**
 * Live status of an integration from the settings being edited.
 * Webhooks need no setup. For anything else the status comes from the
 * add-on that lists it.
 *
 * @param {string} slug Integration slug.
 * @param {Object} ext  Status from page load.
 * @return {{enabled: boolean, configured: boolean}} Status.
 */
export function extensionStatus(slug, ext) {
  if (slug === 'webhooks') {
    return { enabled: !!ext?.enabled, configured: true };
  }
  return { enabled: !!ext?.enabled && ext?.available !== false, configured: !!ext?.configured };
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
  // Only integrations this site can use are listed. Add-ons add their own
  // through the `subtleforms/admin/integrations` filter.
  const extensions = window.subtleformsAdmin?.extensions ?? {};
  const hashSlug = (window.location.hash.match(/[#&]ext=([\w-]+)/) || [])[1];
  const listed = listedExtensions(extensions);
  const firstSlug = (hashSlug && listed.includes(hashSlug) ? hashSlug : null) ?? listed[0] ?? 'webhooks';
  const [activeSlug, setActiveSlug] = useState(firstSlug);

  // The Email marketing panel changes the status dot as soon as a service does.
  const [, refreshStatus] = useReducer((n) => n + 1, 0);
  useEffect(() => {
    window.addEventListener('subtleforms:extension-status', refreshStatus);
    return () => window.removeEventListener('subtleforms:extension-status', refreshStatus);
  }, []);

  const ActivePanel = panelFor(activeSlug, extensions[activeSlug]);

  return (
    <div className='sf-ext-settings'>
      {/* Sidebar */}
      <nav className='sf-ext-settings__sidebar'>
        <ul className='sf-ext-settings__list'>
          {listed.map((slug) => {
            const ext = extensions[slug];
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
                    params.delete('service');
                    window.history.replaceState(null, '', `#${params.toString()}`);
                  }}>
                  <span className='sf-ext-settings__item-label'>{ext.label}</span>
                  <StatusDot {...extensionStatus(slug, ext)} />
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Content */}
      <div className='sf-ext-settings__content'>
        {ActivePanel && listed.includes(activeSlug) && (
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
