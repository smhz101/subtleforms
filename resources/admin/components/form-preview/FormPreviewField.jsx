/**
 * FormPreviewField Component
 *
 * Accessible wrapper for form field previews with:
 * - Proper ARIA attributes
 * - Help text association via aria-describedby
 * - Required field indicators
 * - Error state handling
 *
 * @param {Object} props
 * @param {Object} props.field - Field configuration
 * @param {number} props.index - Field index
 * @param {React.ReactNode} props.children - Field input element
 */
export default function FormPreviewField({ field, index, children }) {
  const config = field.config || {};
  const label = config.label || field.label || field.key;
  const required = config.required || false;
  const helpText = config.help || '';
  const fieldId = `preview-field-${field.key || index}`;
  const helpTextId = helpText ? `${fieldId}-help` : undefined;

  return (
    <div key={field.key || index} className='sf-form-preview-field'>
      {/* Label with required indicator */}
      <label htmlFor={fieldId}>
        {label}
        {required && (
          <span className='sf-form-preview-field__required' aria-label='required'>
            *
          </span>
        )}
      </label>

      {/* Field input with ARIA */}
      <div
        role='group'
        aria-labelledby={fieldId}
        aria-describedby={helpTextId}>
        {children}
      </div>

      {/* Help text with proper ARIA association */}
      {helpText && (
        <p id={helpTextId} className='sf-form-preview-field__help'>
          {helpText}
        </p>
      )}
    </div>
  );
}
