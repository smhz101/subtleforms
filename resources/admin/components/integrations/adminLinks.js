/**
 * Addresses of this plugin's own admin screens, for the steps that happen on
 * this site ("open the form's settings", "open the entry log"). The server
 * hands over the real addresses in `window.subtleformsAdmin.adminUrls`; the
 * fallback is relative to wp-admin, which is where these screens are drawn.
 */
const FALLBACK = {
  forms: 'admin.php?page=subtleforms-forms',
  newForm: 'admin.php?page=subtleforms-new-form',
  entries: 'admin.php?page=subtleforms-submissions',
  settings: 'admin.php?page=subtleforms-settings',
  plugins: 'plugins.php',
};

/**
 * Address of an admin screen of this site.
 *
 * @param {string} name Screen: forms, newForm, entries, settings or plugins.
 * @param {string} [hash] Settings tab and section, for example `tab=logs` (no leading #).
 * @return {string} Address.
 */
export function adminLink(name, hash = '') {
  const urls = (typeof window !== 'undefined' && window.subtleformsAdmin?.adminUrls) || {};
  const base = urls[name] || FALLBACK[name] || FALLBACK.settings;
  return hash ? `${base}#${hash}` : base;
}

/**
 * Address of a settings screen: Settings > Integrations > one service.
 *
 * @param {string} ext     Integration slug (`crm`, `email-marketing`, `webhooks`).
 * @param {string} service Service slug, or '' for the integration's own screen.
 * @return {string} Address.
 */
export function settingsLink(ext, service = '') {
  return adminLink('settings', `tab=extensions&ext=${ext}${service ? `&service=${service}` : ''}`);
}
