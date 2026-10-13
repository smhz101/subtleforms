/**
 * Save a CSV returned by POST /submissions/export ({ csv: base64, filename }).
 *
 * Decodes base64 to raw bytes: passing the atob() string straight to Blob
 * re-encodes every byte as UTF-8, which garbles accents and the BOM.
 *
 * @param {Object} response Export response (already unwrapped or with .data).
 * @return {boolean} Whether a file was offered.
 */
export function downloadCsv(response) {
  const body = response?.csv ? response : response?.data;
  if (!body?.csv) {
    return false;
  }
  const binary = atob(body.csv);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', body.filename || 'subtleforms-entries.csv');
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
