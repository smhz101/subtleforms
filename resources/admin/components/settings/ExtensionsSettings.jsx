import { useEffect, useReducer, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import WebhooksPanel from './extensions/WebhooksPanel';
import EmailMarketingSettings from '../integrations/emailMarketing/EmailMarketingSettings';
import CrmSettings from '../integrations/crm/CrmSettings';
import SectionPanel from '../sectionPanel/SectionPanel';
import SectionHeader from '../sectionPanel/SectionHeader';
import { getSlotItems } from '../../../shared/extend';

// Panels add-ons bring are registered in the `settings.extensions` slot with
// the integration slug as id. Webhooks, Email marketing and CRM are the panels this
// plugin ships. The Email marketing and CRM panels are drawn only while the
// integration list carries this plugin's own entry (`builtin`); an add-on that
// lists its own entry under the same slug draws its panel from the slot instead.
const EXTENSION_PANELS = {
  webhooks: WebhooksPanel,
};
const BUILT_IN_WHEN_LISTED = {
  email_marketing: EmailMarketingSettings,
  crm: CrmSettings,
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
 * Slugs to list in the sidebar: Webhooks, Email marketing, CRM, then what an add-on lists.
 * An entry is shown only when it is available and something draws its panel.
 *
 * @param {Object} extensions Integrations by slug.
 * @return {string[]} Slugs.
 */
export function listedExtensions(extensions) {
  const rank = (slug) => (slug === 'webhooks' ? 0 : slug === 'email_marketing' ? 1 : slug === 'crm' ? 2 : 3);
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
 * The slot item an add-on registered for an integration, or null.
 *
 * @param {string} slug Integration slug.
 * @return {Object|null} { component, order, title, description, status }.
 */
function slotItemFor(slug) {
  return getSlotItems('settings.extensions').find((item) => item.id === slug) ?? null;
}

/**
 * The dot of an integration in the section list: 'on', 'warn' or 'off'.
 *
 * An add-on can set it itself with a `status` on its slot item (a string, or a
 * function returning one); otherwise it follows the integration's entry in the
 * list (enabled and set up is on, enabled only is warn, anything else is off).
 *
 * @param {string}      slug Integration slug.
 * @param {Object|null} ext  The integration's entry in the list.
 * @return {string} 'on', 'warn' or 'off'.
 */
export function dotFor(slug, ext) {
  const item = slotItemFor(slug);
  const set = typeof item?.status === 'function' ? item.status() : item?.status;
  if (set === 'on' || set === 'warn' || set === 'off') return set;
  const { enabled, configured } = extensionStatus(slug, ext);
  if (enabled && configured) return 'on';
  return enabled ? 'warn' : 'off';
}

/**
 * ExtensionsSettings, the Integrations tab of Settings: a section panel with
 * Webhooks, Email marketing, CRM and whatever an add-on lists.
 *
 * An add-on that registers its panel with `title` (and `description`) on the
 * `settings.extensions` slot item gets the standard section header drawn above
 * it. Without a `title` the panel draws its own heading, as before.
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

  const sections = listed.map((slug, index) => {
    const ext = extensions[slug];
    const Panel = panelFor(slug, ext);
    const item = slotItemFor(slug);
    return {
      id: slug,
      label: item?.label || ext.label,
      status: dotFor(slug, ext),
      order: index,
      render: () => (
        <>
          {item?.title ? <SectionHeader title={item.title} description={item.description || ext.description} /> : null}
          {Panel ? <Panel settings={settings} updateSetting={updateSetting} fieldErrors={fieldErrors} /> : null}
        </>
      ),
    };
  });

  return (
    <SectionPanel
      sections={sections}
      current={listed.includes(activeSlug) ? activeSlug : undefined}
      onChange={setActiveSlug}
      urlParam='ext'
      label={__('Integrations', 'subtleforms')}
    />
  );
}
