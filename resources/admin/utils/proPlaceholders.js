/**
 * Pro placeholders for the field library.
 *
 * A field SubtleForms Pro provides is listed here so the library shows what
 * Pro adds. A placeholder is only a label, an icon and an upgrade link: it has
 * no definition, no settings and no renderer behind it, and it cannot be added
 * to a form. When Pro registers the real field type, the placeholder is not
 * shown.
 */
import { __ } from '@wordpress/i18n';

function placeholders() {
  return [
    {
      type: 'picture_choice',
      label: __('Picture Choice', 'subtleforms'),
      icon: 'picture_choice',
      kind: 'input',
      enabled: true,
      category: 'choices',
      meta: {
        description: __('Visitors pick one or more images. Part of SubtleForms Pro.', 'subtleforms'),
      },
      is_pro: true,
      is_pro_locked: true,
      upgrade_key: 'fields.picture_choice',
    },
  ];
}

/**
 * Add the placeholders for fields nobody registered to the grouped library.
 *
 * @param {Object} groups Library groups by category.
 * @return {Object} Groups, with the placeholders added.
 */
export function withProPlaceholders(groups) {
  const out = { ...groups };
  const known = new Set();
  Object.values(out).forEach((list) => (list || []).forEach((f) => known.add(f.type)));
  placeholders().forEach((p) => {
    if (known.has(p.type)) return;
    out[p.category] = [...(out[p.category] || []), p];
  });
  return out;
}
