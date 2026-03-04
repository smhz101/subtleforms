/**
 * Mock for @wordpress/i18n
 * Returns strings unchanged so stories render in the default locale.
 */
export const __ = (text) => text;
export const _n = (single, plural, number) => (number === 1 ? single : plural);
export const _x = (text) => text;
export const _nx = (single, plural, number) => (number === 1 ? single : plural);

export const sprintf = (format, ...args) => {
  let i = 0;
  return format.replace(/%[sd%]/g, (match) => {
    if (match === '%%') return '%';
    return args[i++] ?? match;
  });
};

export const setLocaleData = () => {};
export const getLocaleData = () => ({});
export const isRTL = () => false;
