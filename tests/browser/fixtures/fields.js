/**
 * One sample of every field type the public renderer draws, with the
 * settings bug 1 lost (required, options, placeholder, help text).
 *
 * Used by the Jest renderer test and the Playwright browser tests so both
 * check the same list.
 */

const OPTIONS = [
  { label: 'Alpha', value: 'alpha' },
  { label: 'Bravo', value: 'bravo' },
  { label: 'Charlie', value: 'charlie' },
  { label: 'Delta', value: 'delta' },
];

/**
 * Field samples.
 *
 * `check` says which parts apply to the type:
 *   placeholder: the control shows the placeholder (attribute or first option)
 *   options:     how many choices are drawn
 *   native:      a native control carries the HTML required attribute
 */
const SAMPLES = [
  { type: 'text', extra: { placeholder: 'Type here' }, check: { placeholder: true, native: true } },
  { type: 'email', extra: { placeholder: 'you@example.com' }, check: { placeholder: true, native: true } },
  { type: 'url', extra: { placeholder: 'https://' }, check: { placeholder: true, native: true } },
  { type: 'number', extra: { placeholder: '42' }, check: { placeholder: true, native: true } },
  { type: 'phone', extra: { placeholder: '+1 555' }, check: { placeholder: true, native: true } },
  { type: 'password', extra: { placeholder: 'Secret' }, check: { placeholder: true, native: true } },
  { type: 'textarea', extra: { placeholder: 'Tell us more' }, check: { placeholder: true, native: true } },
  { type: 'date', extra: {}, check: { native: true } },
  { type: 'time', extra: {}, check: { native: true } },
  { type: 'datetime', extra: {}, check: { native: true } },
  { type: 'select', extra: { placeholder: 'Choose one', options: OPTIONS }, check: { placeholder: true, options: 4, native: true } },
  { type: 'dropdown', extra: { placeholder: 'Choose one', options: OPTIONS }, check: { placeholder: true, options: 4, native: true } },
  { type: 'radio', extra: { options: OPTIONS }, check: { options: 4 } },
  { type: 'multiple_choice', extra: { options: OPTIONS }, check: { options: 4 } },
  { type: 'multiple_choice', key: 'multiple_choice_many', extra: { options: OPTIONS, allowMultiple: true }, check: { options: 4 } },
  { type: 'checkbox', extra: { checkboxLabel: 'I agree' }, check: { native: true } },
  { type: 'consent', extra: { checkboxLabel: 'I accept the terms' }, check: { native: true } },
  { type: 'country', extra: { placeholder: 'Pick a country' }, check: { placeholder: true, countries: true, native: true } },
  { type: 'rating', extra: { max: 5 }, check: { options: 5 } },
  { type: 'range_slider', extra: { min: 0, max: 10 }, check: {} },
  { type: 'net_promoter_score', extra: {}, check: { options: 11 } },
  { type: 'scale', extra: { scaleMin: 1, scaleMax: 5 }, check: { options: 5 } },
  { type: 'toggle', extra: { toggleLabel: 'Yes please' }, check: {} },
  { type: 'checkbox_grid', extra: { rows: ['Row A', 'Row B'], columns: ['Col 1', 'Col 2', 'Col 3'] }, check: { options: 6 } },
  { type: 'picture_choice', extra: { options: OPTIONS }, check: { options: 4 } },
  { type: 'color_picker', extra: {}, check: {} },
  { type: 'rich_text', extra: { placeholder: 'Format me' }, check: {} },
  { type: 'signature', extra: {}, check: {} },
  { type: 'file_upload', extra: {}, check: {} },
  { type: 'chained_select', extra: { options: [{ label: 'Fruit', value: 'fruit', children: [{ label: 'Apple', value: 'apple' }] }] }, check: {} },
  { type: 'calculation', extra: { formula: '1 + 1', required: false }, check: { noRequired: true } },
];

const WIDTHS = ['100', '75', '66', '50', '33', '25'];

/**
 * Build a field node.
 *
 * @param {Object} sample One of SAMPLES.
 * @param {string} width  Field width.
 * @param {string} shape  'flat' (appearance on the node) or 'wrapped' (a
 *                        partial `config` that only holds the appearance, the
 *                        shape that broke on the live site).
 * @return {Object} Field node.
 */
function buildField(sample, width, shape) {
  const base = sample.key || sample.type;
  const key = `${base}_${shape}`;
  const appearance = width === '100' ? {} : { width };
  const node = {
    id: `f_${key}`,
    key,
    type: sample.type,
    label: `${base} ${shape} label`,
    required: true,
    description: `Help for ${key}`,
    ...sample.extra,
  };
  if (shape === 'flat') {
    if (width !== '100') node.appearance = appearance;
  } else {
    node.config = { appearance: { ...appearance, colorLabel: '#1e1e1e' } };
  }
  return node;
}

/** All fields for one width, in both shapes. */
function fieldsForWidth(width) {
  const out = [];
  SAMPLES.forEach((sample) => {
    out.push(buildField(sample, width, 'flat'));
    out.push(buildField(sample, width, 'wrapped'));
  });
  return out;
}

module.exports = { SAMPLES, WIDTHS, OPTIONS, buildField, fieldsForWidth };
