/**
 * How the admin app names the plugin (2.1): name, menu name and logo.
 *
 * Comes from `subtleformsAdmin.branding`, built by AdminMenu::branding() and
 * filtered by `subtleforms/admin_branding`.
 */
const DEFAULTS = {
  name: 'SubtleForms',
  menuName: 'SubtleForms',
  logoUrl: '',
};

const SUPPORT_URL = 'https://subtleforms.com/support';

/** Where "Get support" links go. */
export function supportUrl() {
  return SUPPORT_URL;
}

export function getBranding() {
  const b = window.subtleformsAdmin?.branding;
  const out = { ...DEFAULTS };
  if (b && typeof b === 'object') {
    ['name', 'menuName', 'logoUrl'].forEach((key) => {
      if (typeof b[key] === 'string') out[key] = b[key];
    });
  }
  return out;
}
