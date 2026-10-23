import { useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import WebhooksPanel from './extensions/WebhooksPanel';
import { getSlotItems } from '../../../shared/extend';

// Panels add-ons bring are registered in the `settings.extensions` slot with
// the integration slug as id (form analytics is one, from SubtleForms Pro).
// Webhooks is the only panel this plugin ships.
const EXTENSION_PANELS = {
  webhooks: WebhooksPanel,
};

/**
 * The panel for an integration slug, or null when nothing provides one.
 *
 * @param {string} slug Integration slug.
 * @return {Function|null} Component.
 */
function panelFor(slug) {
  return (
    EXTENSION_PANELS[slug] ??
    getSlotItems('settings.extensions').find((item) => item.id === slug)?.component ??
    null
  );
}

/**
 * Slugs to list in the sidebar: Webhooks first, then what an add-on lists.
 * An entry is shown only when something can draw it: a panel, or the locked
 * card for an integration the plan does not include.
 *
 * @param {Object} extensions Integrations by slug.
 * @return {string[]} Slugs.
 */
export function listedExtensions(extensions) {
  const slugs = Object.keys(extensions).sort((a, b) => (a === 'webhooks' ? -1 : b === 'webhooks' ? 1 : 0));
  return slugs.filter((slug) => {
    const ext = extensions[slug];
    return ext && (ext.available ? !!panelFor(slug) : !!ext.requires);
  });
}

/**
 * Live status of an integration from the settings being edited (PRO-30).
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
  // Only integrations this site can use are listed. SubtleForms Pro adds
  // its own through the `subtleforms/admin/integrations` filter.
  const allExtensions = window.subtleformsAdmin?.extensions ?? {};
  // Integrations the plan does not include are listed with the plan that has
  // them (PRO-08), when SubtleForms Pro says which one.
  const extensions = Object.fromEntries(
    Object.entries(allExtensions).filter(([, ext]) => ext && (ext.available || ext.requires))
  );
  const hideUpgrade = !!window.subtleformsAdmin?.branding?.hideUpgrade;
  const hasPro = !!window.subtleformsAdmin?.hasProPlugin;
  const hashSlug = (window.location.hash.match(/[#&]ext=([\w-]+)/) || [])[1];
  const listed = listedExtensions(extensions);
  const firstSlug = (hashSlug && listed.includes(hashSlug) ? hashSlug : null) ?? listed[0] ?? 'webhooks';
  const [activeSlug, setActiveSlug] = useState(firstSlug);

  const ActivePanel = panelFor(activeSlug);

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
                    window.history.replaceState(null, '', `#${params.toString()}`);
                  }}>
                  <span className='sf-ext-settings__item-label'>{ext.label}</span>
                  {ext.available ? (
                    <StatusDot {...extensionStatus(slug, ext)} />
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
