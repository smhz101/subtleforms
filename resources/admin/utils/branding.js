/**
 * Admin branding (white label, 2.1).
 *
 * Comes from `subtleformsAdmin.branding`, built by AdminMenu::branding() and
 * filtered by `subtleforms/admin_branding` (SubtleForms Pro, Agency plan).
 */
const DEFAULTS = {
  name: 'SubtleForms',
  menuName: 'SubtleForms',
  logoUrl: '',
  hideCredits: false,
  hideHelp: false,
  hideUpgrade: false,
  showLicense: true,
  // Custom "Get support" link (white label, 2.3.0).
  supportUrl: '',
};

const SUPPORT_URL = 'https://subtleforms.com/support';

/** Where "Get support" links go: the white-label support URL, or SubtleForms. */
export function supportUrl() {
  return getBranding().supportUrl || SUPPORT_URL;
}

export function getBranding() {
  const b = window.subtleformsAdmin?.branding;
  return b && typeof b === 'object' ? { ...DEFAULTS, ...b } : { ...DEFAULTS };
}

/** Whether the plugin is shown under a custom name. */
export function isWhiteLabelled() {
  const b = getBranding();
  return b.name !== DEFAULTS.name || !!b.logoUrl || b.hideCredits;
}
