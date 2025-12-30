/**
 * Block Save Function
 *
 * Outputs minimal placeholder markup for frontend rendering.
 * The actual form is rendered dynamically by frontend.js when it detects
 * elements with .subtleforms-block class.
 *
 * This keeps post content clean and ensures dynamic behavior.
 */
export default function save({ attributes }) {
  const { formId, align, className } = attributes;

  if (!formId) {
    return null;
  }

  const classes = ['subtleforms-block', align ? `align${align}` : '', className || '']
    .filter(Boolean)
    .join(' ');

  return <div className={classes} data-form-id={formId} />;
}
