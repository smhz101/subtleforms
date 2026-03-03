import { Modal, Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import Icon from '../ui/Icon';
import FormPreviewHeader from './FormPreviewHeader';
import FormPreviewFooter from './FormPreviewFooter';
import FormPreviewField from './FormPreviewField';
import {
  TextFieldPreview,
  ChoiceFieldPreview,
  DateTimeFieldPreview,
  FileFieldPreview,
  CompositeFieldPreview,
  SpecialFieldPreview,
} from './fields';
import '../FormPreviewModal.scss';

/**
 * FormPreviewModal Component (Refactored)
 *
 * Accessible form preview with WCAG 2.1 AA compliance:
 * - Proper ARIA attributes (aria-labelledby, aria-describedby)
 * - Help text association for all fields
 * - Screen reader announcements
 * - Keyboard accessible
 *
 * ⚠️ TASK 5.4 - Preview Uses Draft Schema (NEVER Active)
 * - Renders read-only preview of current draft schema
 * - NO backend mutations (all inputs disabled)
 * - Does NOT fetch active schema from server
 * - Schema prop is draftSchema from BuilderPage state
 */
export default function FormPreviewModal({ schema, onClose, isDirty = false }) {
  if (!schema || !schema.fields) {
    return null;
  }

  const formType = schema.metadata?.type || 'regular';
  const isConversational = formType === 'conversational';

  /**
   * Render individual field with proper component
   */
  const renderFieldContent = (field, fieldId) => {
    // Text-based fields
    if (['text', 'email', 'tel', 'url', 'number', 'textarea'].includes(field.type)) {
      return <TextFieldPreview field={field} fieldId={fieldId} />;
    }

    // Choice fields
    if (['select', 'dropdown', 'radio', 'checkbox'].includes(field.type)) {
      return <ChoiceFieldPreview field={field} fieldId={fieldId} />;
    }

    // Date/Time fields
    if (['date', 'time'].includes(field.type)) {
      return <DateTimeFieldPreview field={field} fieldId={fieldId} />;
    }

    // File upload
    if (['file', 'upload'].includes(field.type)) {
      return <FileFieldPreview field={field} fieldId={fieldId} />;
    }

    // Composite fields
    if (['name_group', 'address_group'].includes(field.type)) {
      return <CompositeFieldPreview field={field} fieldId={fieldId} />;
    }

    // Special fields
    if (['captcha', 'country', 'hidden'].includes(field.type)) {
      return <SpecialFieldPreview field={field} fieldId={fieldId} />;
    }

    // Fallback for unknown field types
    return (
      <p className='sf-form-preview-field__unsupported' role='status'>
        {__('Preview not available for this field type', 'subtleforms')}
      </p>
    );
  };

  /**
   * Render field with accessible wrapper
   */
  const renderField = (field, index) => {
    const fieldId = `preview-field-${field.key || index}`;

    return (
      <FormPreviewField key={field.key || index} field={field} index={index}>
        {renderFieldContent(field, fieldId)}
      </FormPreviewField>
    );
  };

  return (
    <Modal
      title={
        <div className='sf-form-preview-modal__header'>
          <span>{__('Form Preview', 'subtleforms')}</span>
          <button
            onClick={onClose}
            className='sf-form-preview-modal__close-btn'
            aria-label={__('Close preview', 'subtleforms')}>
            <Icon.Close aria-hidden='true' />
          </button>
        </div>
      }
      onRequestClose={onClose}
      className='subtleforms-preview-modal'
      style={{ maxWidth: '700px', width: '100%' }}
      aria-labelledby='form-preview-title'
      aria-describedby='form-preview-description'>
      <div className='sf-form-preview-modal__container'>
        {/* Header with title and description */}
        <FormPreviewHeader metadata={schema.metadata} isDirty={isDirty} />

        {/* Form Fields */}
        <div
          className='sf-form-preview-modal__fields'
          role='form'
          aria-label={__('Form preview (disabled)', 'subtleforms')}>
          {isConversational && (
            <div
              className='sf-form-preview-modal__conversational-notice'
              role='note'
              aria-live='polite'>
              <p>
                {__(
                  'Conversational forms display one question at a time. This preview shows all fields together.',
                  'subtleforms'
                )}
              </p>
            </div>
          )}

          {schema.fields.length > 0 ? (
            schema.fields.map((field, index) => renderField(field, index))
          ) : (
            <div className='sf-form-preview-modal__empty' role='status'>
              <p>
                {__(
                  'No fields added yet. Add fields to see the preview.',
                  'subtleforms'
                )}
              </p>
            </div>
          )}
        </div>

        {/* Footer with submit button */}
        <FormPreviewFooter />
      </div>
    </Modal>
  );
}
