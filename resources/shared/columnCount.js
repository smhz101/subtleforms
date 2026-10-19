/**
 * How many columns a container type is.
 *
 * `two_column_container` is a word, not a number. parseInt("two") is NaN,
 * which became the class subtleforms-columns-NaN (FA-22).
 *
 * @param {string} type Field type.
 * @return {number} Column count, or 0 when the type is not a column container.
 */
export function columnCountFromType(type) {
  const word = String(type || '').replace(/_column_container$/, '');
  if (word === String(type || '')) {
    return 0;
  }
  if (/^\d+$/.test(word)) {
    return parseInt(word, 10);
  }
  const words = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
  return words[word] || 0;
}
