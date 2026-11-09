/**
 * Download the entries as a CSV file.
 *
 * The file is streamed by the server (admin-post.php, 2.8.1): the browser
 * navigates to the download address and saves the response as it arrives,
 * instead of fetching the whole file inside JSON and building a Blob.
 */

const FILTER_KEYS = ['form_id', 'status', 'search', 'range', 'after'];

/**
 * The download address for a set of filters.
 *
 * @param {Object} filters form_id, status, search, range, after. Empty values are left out.
 * @return {string} Address, or an empty string when the page has no download address.
 */
export function csvExportUrl(filters = {}) {
  const admin = window.subtleformsAdmin || {};
  if (!admin.exportCsvUrl) {
    return '';
  }
  const url = new URL(admin.exportCsvUrl, window.location.href);
  FILTER_KEYS.forEach((key) => {
    const value = filters[key];
    if (value !== undefined && value !== null && value !== '' && value !== 'all') {
      url.searchParams.set(key, String(value));
    }
  });
  url.searchParams.set('_wpnonce', admin.exportCsvNonce || '');
  return url.toString();
}

/**
 * Start the download.
 *
 * @param {Object} filters See csvExportUrl().
 * @return {boolean} Whether a download was started.
 */
export function startCsvDownload(filters = {}) {
  const href = csvExportUrl(filters);
  if (!href) {
    return false;
  }
  const link = document.createElement('a');
  link.href = href;
  link.setAttribute('download', '');
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  return true;
}
