/**
 * US phone formatting (FB-08). Ten digits become (555) 010-1234.
 *
 * @param {string} value Raw input.
 * @return {string}
 */
export function formatUsPhone(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 10);
  if (digits.length < 4) return digits;
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function isCompleteUsPhone(value) {
  return String(value || '').replace(/\D/g, '').length === 10;
}
