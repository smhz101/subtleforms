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

/**
 * Whether the choice at `index` is drawn checked on the canvas. A single
 * choice list (radio buttons) checks only the first match, so a default that
 * names two choices never shows two selected radios.
 *
 * @param {Array<{value: *}>} options Choices.
 * @param {*}                 raw     defaultValue.
 * @param {number}            index   Choice position.
 * @param {boolean}           single  Radio buttons rather than checkboxes.
 * @return {boolean}
 */
export function choiceChecked(options, raw, index, single = false) {
  const list = Array.isArray(options) ? options : [];
  if (!list[index] || !choiceShowsDefault(raw, list[index].value)) {
    return false;
  }
  if (!single) {
    return true;
  }
  return list.findIndex((option) => choiceShowsDefault(raw, option.value)) === index;
}
