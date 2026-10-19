/**
 * A short strength label for a password. Shown under the input when the
 * field's strength meter is on (FB-03).
 *
 * @param {string} value Password.
 * @return {'weak'|'fair'|'strong'}
 */
export function passwordStrength(value) {
  const text = String(value || '');
  if (!text) {
    return 'weak';
  }
  let score = 0;
  if (text.length >= 8) score += 1;
  if (text.length >= 12) score += 1;
  if (/[a-z]/.test(text) && /[A-Z]/.test(text)) score += 1;
  if (/\d/.test(text)) score += 1;
  if (/[^A-Za-z0-9]/.test(text)) score += 1;
  if (score <= 2) return 'weak';
  if (score <= 3) return 'fair';
  return 'strong';
}

