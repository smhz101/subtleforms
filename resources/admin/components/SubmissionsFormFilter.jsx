import { ComboboxControl } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';

/**
 * "All forms" first, then every form as "Title (#id)" so two forms with the
 * same title can be told apart.
 */
export function buildFormOptions(forms) {
  return [
    { label: __('All forms', 'subtleforms'), value: 'all' },
    ...(Array.isArray(forms) ? forms : []).map((form) => ({
      label: sprintf(
        /* translators: 1: form title, 2: form id */
        __('%1$s (#%2$d)', 'subtleforms'),
        form.title || __('(no title)', 'subtleforms'),
        form.id
      ),
      value: String(form.id),
    })),
  ];
}

/**
 * Searchable Form filter for the Submissions screen. While the forms load it
 * still shows the current selection, so a form picked from the URL is visible
 * and the control stays usable.
 */
export default function SubmissionsFormFilter({ forms, value, onChange }) {
  const options = buildFormOptions(forms);
  const known = options.some((option) => option.value === value);
  const shown = known
    ? options
    : [
        ...options,
        {
          label: sprintf(
            /* translators: %d: form id */
            __('Form #%d', 'subtleforms'),
            Number(value)
          ),
          value,
        },
      ];

  return (
    <ComboboxControl
      label={__('Form', 'subtleforms')}
      value={value}
      options={shown}
      onChange={(next) => onChange(next || 'all')}
      className='sf-filter-control sf-form-filter'
    />
  );
}
