/**
 * Short form of a count for a small badge: exact up to 999, then "1k", "1.2k"
 * (one decimal under 10k), "12k" and so on. The value is cut, never rounded
 * up, so a badge never claims more than there is: 1999 is "1.9k", 999999 is
 * "999k".
 *
 * @param {number|string} value Count.
 * @return {string} Badge text.
 */
export function formatCompactCount(value) {
  const n = Math.max(0, Math.floor(Number(value) || 0));
  if (n < 1000) {
    return String(n);
  }
  const units = [
    { size: 1e9, suffix: 'B' },
    { size: 1e6, suffix: 'M' },
    { size: 1e3, suffix: 'k' },
  ];
  const { size, suffix } = units.find((unit) => n >= unit.size);
  const scaled = n / size;
  if (scaled < 10) {
    // One decimal, cut: 1.99 is 1.9. A trailing .0 is dropped.
    const tenths = Math.floor(scaled * 10) / 10;
    return `${Number.isInteger(tenths) ? tenths : tenths.toFixed(1)}${suffix}`;
  }
  return `${Math.floor(scaled)}${suffix}`;
}

export default formatCompactCount;
