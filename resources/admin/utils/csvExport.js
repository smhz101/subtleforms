/**
 * Download the entries as a CSV file.
 *
 * The file is streamed by the server (admin-post.php, 2.8.1): the browser
 * navigates to the download address and saves the response as it arrives,
 * instead of fetching the whole file inside JSON and building a Blob.
 *
 * Three things keep a failed download from being silent:
 *  - the list knows how many entries match, so a filter with none starts no
 *    download and says so;
 *  - the download nonce is fetched just before the address is built, so a
 *    screen left open for days still exports;
 *  - when the server still refuses (nothing to export, an old nonce, no
 *    permission) it sends the browser back to the screen with
 *    ?sf_export=empty|expired|forbidden, which exportFlagNotice() turns into
 *    a notice.
 */

import { __ } from '@wordpress/i18n';
import { apiPost } from './api';

const FILTER_KEYS = ['form_id', 'status', 'search', 'range', 'after'];

/**
 * The filters whose "all" is the dropdown's own "no filter" choice. A search
 * for the word "all" is a real search and is kept.
 */
const DROPDOWN_KEYS = ['status', 'range'];

/** The address parameter the server adds when it sends the browser back. */
export const EXPORT_FLAG = 'sf_export';

const admin = () => window.subtleformsAdmin || {};

/**
 * The download address for a set of filters.
 *
 * @param {Object} filters form_id, status, search, range, after. Empty values are left out.
 * @param {string} [nonce] Nonce for the address. Defaults to the one the page was given.
 * @return {string} Address, or an empty string when the page has no download address.
 */
export function csvExportUrl(filters = {}, nonce = admin().exportCsvNonce || '') {
  if (!admin().exportCsvUrl) {
    return '';
  }
  const url = new URL(admin().exportCsvUrl, window.location.href);
  FILTER_KEYS.forEach((key) => {
    const value = filters[key];
    if (value === undefined || value === null || value === '') {
      return;
    }
    if (value === 'all' && DROPDOWN_KEYS.includes(key)) {
      return;
    }
    url.searchParams.set(key, String(value));
  });
  url.searchParams.set('_wpnonce', nonce);
  return url.toString();
}

/**
 * Get WordPress's own fresh REST nonce, the way core does for api-fetch.
 *
 * A screen left open for a day has an old REST nonce too, and the server
 * answers 403 to the call for the download nonce. Core publishes where to get
 * a new one (wp.apiFetch.nonceEndpoint, admin-ajax.php?action=rest-nonce,
 * which needs only the login cookie) and where api-fetch keeps the nonce it
 * sends (wp.apiFetch.nonceMiddleware.nonce). api-fetch only does this by
 * itself for parsed responses, and these helpers ask for the raw one.
 *
 * @return {Promise<boolean>} Whether api-fetch now has a new REST nonce.
 */
async function refreshRestNonce() {
  try {
    const apiFetch = window.wp && window.wp.apiFetch;
    if (!apiFetch || !apiFetch.nonceMiddleware || !apiFetch.nonceEndpoint) {
      return false;
    }
    const response = await window.fetch(apiFetch.nonceEndpoint, { credentials: 'same-origin' });
    if (!response.ok) {
      return false;
    }
    const nonce = (await response.text()).trim();
    if (!/^[a-f0-9]{6,}$/i.test(nonce)) {
      return false;
    }
    apiFetch.nonceMiddleware.nonce = nonce;
    return true;
  } catch {
    return false;
  }
}

/**
 * A nonce for the download that has not had time to expire.
 *
 * The page's own nonce is made when it loads and lasts a day or so. This asks
 * the server for a new one right before the download starts (renewing the REST
 * nonce first when that is what expired), and falls back to the page's nonce
 * when the call fails.
 *
 * @return {Promise<string>} Nonce.
 */
export async function freshExportNonce() {
  const fallback = admin().exportCsvNonce || '';
  try {
    let result = await apiPost('/submissions/export-nonce', {});
    if (!result?.ok && result?.status === 403 && (await refreshRestNonce())) {
      result = await apiPost('/submissions/export-nonce', {});
    }
    const nonce = result?.ok ? result.body?.data?.nonce : '';
    if (typeof nonce === 'string' && nonce !== '') {
      if (window.subtleformsAdmin) {
        window.subtleformsAdmin.exportCsvNonce = nonce;
      }
      return nonce;
    }
  } catch {
    // Use the page's nonce.
  }
  return fallback;
}

/**
 * Start the download.
 *
 * @param {Object} filters See csvExportUrl().
 * @param {Object} [options]
 * @param {number|null} [options.total] How many entries the list shows for these filters,
 *                                      or null when it is not known (still loading).
 * @return {Promise<'started'|'empty'|'unavailable'>} 'empty' when the filters match nothing
 *         (nothing is downloaded), 'unavailable' when the page has no download address.
 */
export async function startCsvDownload(filters = {}, { total = null } = {}) {
  if (typeof total === 'number' && total <= 0) {
    return 'empty';
  }
  if (!admin().exportCsvUrl) {
    return 'unavailable';
  }
  const href = csvExportUrl(filters, await freshExportNonce());
  // A plain navigation, not a "download" link: the file arrives as an
  // attachment and the page stays where it is, but a refusal from the server
  // is a redirect back to this screen and has to be followed to show its notice.
  const link = document.createElement('a');
  link.href = href;
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  return 'started';
}

/**
 * Download the selected entries.
 *
 * Posted as a form so a long selection does not have to fit in an address.
 *
 * @param {number[]} ids Entry IDs.
 * @return {Promise<'started'|'empty'|'unavailable'>} See startCsvDownload().
 */
export async function startCsvDownloadOfIds(ids = []) {
  const list = (Array.isArray(ids) ? ids : []).map((id) => parseInt(id, 10)).filter((id) => id > 0);
  if (list.length === 0) {
    return 'empty';
  }
  if (!admin().exportCsvUrl) {
    return 'unavailable';
  }
  const nonce = await freshExportNonce();
  const form = document.createElement('form');
  form.method = 'post';
  form.action = new URL(admin().exportCsvUrl, window.location.href).toString();
  form.style.display = 'none';
  const add = (name, value) => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = String(value);
    form.appendChild(input);
  };
  add('_wpnonce', nonce);
  list.forEach((id) => add('ids[]', id));
  document.body.appendChild(form);
  form.submit();
  document.body.removeChild(form);
  return 'started';
}

/**
 * The notice for the flag the server adds when it refuses a download.
 *
 * @param {string|null} flag empty, expired or forbidden.
 * @return {{type: string, message: string}|null} Null for no flag or an unknown one.
 */
export function exportFlagNotice(flag) {
  switch (flag) {
    case 'empty':
      return { type: 'warning', message: __('No submissions to export', 'subtleforms') };
    case 'expired':
      return {
        type: 'error',
        message: __('The export link expired, reload the page and try again', 'subtleforms'),
      };
    case 'forbidden':
      return { type: 'error', message: __('You do not have permission to export', 'subtleforms') };
    default:
      return null;
  }
}

/**
 * The flag in the page address, if the server sent the browser back with one.
 *
 * @param {string} [search] Query string. Defaults to the page's.
 * @return {string|null} The flag.
 */
export function readExportFlag(search = window.location.search) {
  try {
    return new URLSearchParams(search).get(EXPORT_FLAG);
  } catch {
    return null;
  }
}
