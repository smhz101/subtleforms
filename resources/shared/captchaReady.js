/**
 * Which CAPTCHA fields have keys (#142). A field is ready when it has both a
 * site key and a secret key of its own, or when Settings holds both for its
 * provider. The server skips a field that is not ready, so the builder
 * warns about it before and after publishing.
 */

const PROVIDERS = ['recaptcha', 'hcaptcha', 'turnstile'];

export const CAPTCHA_SETTINGS_URL = 'admin.php?page=subtleforms-settings#tab=advanced';

/**
 * @param {Object} field Field node.
 * @return {string} recaptcha, hcaptcha, turnstile or ''.
 */
export function captchaProvider(field) {
  const type = field?.type;
  if (PROVIDERS.includes(type)) {
    return type;
  }
  if (type === 'captcha') {
    const named = field.provider || field.config?.provider || '';
    return PROVIDERS.includes(named) ? named : '';
  }
  return '';
}

function ownKey(field, name) {
  const value = field?.[name] ?? field?.config?.[name] ?? '';
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * @param {Object} field       CAPTCHA field node.
 * @param {Object} globalReady { recaptcha, hcaptcha, turnstile } booleans from Settings.
 * @return {boolean}
 */
export function captchaFieldReady(field, globalReady = window.subtleformsData?.captchaReady) {
  const provider = captchaProvider(field);
  if (!provider) {
    return true;
  }
  if (ownKey(field, 'site_key') && ownKey(field, 'secret_key')) {
    return true;
  }
  return Boolean(globalReady?.[provider]);
}

/**
 * CAPTCHA fields that have no keys, including ones inside containers and steps.
 *
 * @param {Array}  fields      Field nodes.
 * @param {Object} globalReady Provider flags.
 * @return {Array}
 */
export function unconfiguredCaptchaFields(fields, globalReady = window.subtleformsData?.captchaReady) {
  const found = [];
  const walk = (nodes) => {
    if (!Array.isArray(nodes)) {
      return;
    }
    nodes.forEach((field) => {
      if (!field || typeof field !== 'object') {
        return;
      }
      if (captchaProvider(field) && !captchaFieldReady(field, globalReady)) {
        found.push(field);
      }
      walk(field.children);
      walk(field.fields);
      if (Array.isArray(field.columns)) {
        field.columns.forEach((column) => {
          if (Array.isArray(column)) {
            walk(column);
          } else if (column && typeof column === 'object') {
            walk(column.fields);
            walk(column.children);
          }
        });
      }
    });
  };
  walk(fields);
  return found;
}
