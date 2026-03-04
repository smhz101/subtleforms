/**
 * Mock for @wordpress/url
 */
export const addQueryArgs = (url, args = {}) => {
  const params = new URLSearchParams(args).toString();
  return params ? `${url}?${params}` : url;
};
export const getQueryArg = (url, arg) => new URL(url, 'http://x').searchParams.get(arg);
export const removeQueryArgs = (url, ...args) => {
  const u = new URL(url, 'http://x');
  args.forEach((a) => u.searchParams.delete(a));
  return u.pathname + (u.search ? u.search : '');
};
export const isURL = (url) => {
  try { new URL(url); return true; } catch { return false; }
};
