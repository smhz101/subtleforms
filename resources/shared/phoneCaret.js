import { formatUsPhone } from './phoneFormat';

/**
 * Format a US phone edit and place the caret by digit count, so separators
 * added or removed by the formatting do not move it. Deleting only a
 * separator with Backspace (")" in the way) removes the digit before it; Delete
 * and selection deletes never remove an extra digit.
 *
 * @param {string} prev Value shown before the edit.
 * @param {string} typed Value in the input after the edit.
 * @param {number} caret Caret position in `typed`.
 * @param {string} [inputType] The input event's inputType, when the browser gives one.
 * @return {{value: string, caret: number}}
 */
export function editUsPhone(prev, typed, caret, inputType = '') {
  const text = String(typed ?? '');
  const at = Math.min(caret ?? text.length, text.length);
  let before = text.slice(0, at).replace(/\D/g, '').length;
  let digits = text.replace(/\D/g, '');
  if (
    inputType === 'deleteContentBackward' &&
    String(prev ?? '').length - text.length === 1 &&
    digits.length === String(prev ?? '').replace(/\D/g, '').length &&
    before > 0
  ) {
    digits = digits.slice(0, before - 1) + digits.slice(before);
    before -= 1;
  }
  const value = formatUsPhone(digits);
  if (at >= text.length) {
    return { value, caret: value.length };
  }
  let seen = 0;
  let pos = 0;
  while (pos < value.length && seen < before) {
    if (/\d/.test(value[pos])) seen += 1;
    pos += 1;
  }
  return { value, caret: pos };
}
