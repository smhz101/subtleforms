/**
 * Whether a canvas choice should look selected from the field default (FB-24).
 *
 * @param {*}    raw         defaultValue.
 * @param {string} optionValue Choice value.
 * @return {boolean}
 */
export function choiceShowsDefault(raw, optionValue) {
  if (Array.isArray(raw)) {
    return raw.map(String).includes(String(optionValue));
  }
  if (raw === undefined || raw === null || raw === '') {
    return false;
  }
  const text = String(raw);
  if (text.includes(',')) {
    return text.split(',').map((part) => part.trim()).includes(String(optionValue));
  }
  return text === String(optionValue);
}
