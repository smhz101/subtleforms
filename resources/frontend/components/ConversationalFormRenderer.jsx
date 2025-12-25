import { useState, useEffect, useCallback, useMemo } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import FieldRenderer from './FieldRenderer';

const restUrl =
  window.subtleformsFrontend?.restUrl || '/wp-json/subtleforms/v1';

/**
 * ConversationalFormRenderer - Renders form one question at a time
 *
 * Displays fields sequentially with smooth transitions and per-field validation
 */
export default function ConversationalFormRenderer({ schema, formId }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [values, setValues] = useState({});
  const [validationErrors, setValidationErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  // Flatten all fields for rendering
  const allFields = useMemo(() => {
    if (!schema?.fields) return [];

    const flatten = (fields) => {
      let result = [];
      fields.forEach((field) => {
        // Skip container types in conversational mode
        if (field.type !== 'step' && field.type !== 'section') {
          result.push(field);
        }
        if (field.children && Array.isArray(field.children)) {
          result = result.concat(flatten(field.children));
        }
        if (field.columns && Array.isArray(field.columns)) {
          field.columns.forEach((col) => {
            if (Array.isArray(col)) {
              result = result.concat(flatten(col));
            }
          });
        }
      });
      return result;
    };

    return flatten(schema.fields);
  }, [schema]);

  // Evaluate conditional logic
  const hiddenFields = useMemo(() => {
    const hidden = new Set();

    allFields.forEach((field) => {
      const conditions = field.config?.conditions || [];

      conditions.forEach((condition) => {
        const sourceValue = values[condition.sourceField];
        let matches = false;

        switch (condition.operator) {
          case 'equals':
            matches = String(sourceValue) === String(condition.value);
            break;
          case 'not_equals':
            matches = String(sourceValue) !== String(condition.value);
            break;
          case 'empty':
            matches = !sourceValue || sourceValue === '';
            break;
          case 'not_empty':
            matches = sourceValue && sourceValue !== '';
            break;
          case 'contains':
            if (Array.isArray(sourceValue)) {
              matches = sourceValue.includes(condition.value);
            } else {
              matches = String(sourceValue).includes(String(condition.value));
            }
            break;
          case 'greater_than':
            matches = parseFloat(sourceValue) > parseFloat(condition.value);
            break;
          case 'less_than':
            matches = parseFloat(sourceValue) < parseFloat(condition.value);
            break;
          default:
            break;
        }

        if (condition.effect === 'hide' && matches) {
          hidden.add(field.config?.key || field.key);
        } else if (condition.effect === 'show' && !matches) {
          hidden.add(field.config?.key || field.key);
        }
      });
    });

    return hidden;
  }, [allFields, values]);

  // Get visible fields
  const visibleFields = useMemo(() => {
    return allFields.filter((field) => {
      const fieldKey = field.config?.key || field.key;
      return !hiddenFields.has(fieldKey);
    });
  }, [allFields, hiddenFields]);

  const currentField = visibleFields[currentIndex];
  const totalFields = visibleFields.length;
  const isLastField = currentIndex === totalFields - 1;
  const progressPercent =
    totalFields > 0 ? ((currentIndex + 1) / totalFields) * 100 : 0;

  // Validate current field
  const validateCurrentField = useCallback(() => {
    if (!currentField) return true;

    const fieldKey = currentField.config?.key || currentField.key;
    const value = values[fieldKey];
    const isRequired = currentField.config?.required === true;

    // Clear previous error
    setValidationErrors((prev) => {
      const next = { ...prev };
      delete next[fieldKey];
      return next;
    });

    // Required validation
    if (isRequired && (!value || value === '')) {
      setValidationErrors((prev) => ({
        ...prev,
        [fieldKey]: __('This field is required.', 'subtleforms'),
      }));
      return false;
    }

    return true;
  }, [currentField, values]);

  // Handle field change
  const handleChange = useCallback((fieldKey, value) => {
    setValues((prev) => ({
      ...prev,
      [fieldKey]: value,
    }));

    // Clear validation error when user types
    setValidationErrors((prev) => {
      const next = { ...prev };
      delete next[fieldKey];
      return next;
    });
  }, []);

  // Handle next
  const handleNext = useCallback(() => {
    if (!validateCurrentField()) {
      return;
    }

    if (currentIndex < totalFields - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  }, [validateCurrentField, currentIndex, totalFields]);

  // Handle previous
  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  }, [currentIndex]);

  // Handle Enter key to advance
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (
        e.key === 'Enter' &&
        !e.shiftKey &&
        currentField?.type !== 'textarea'
      ) {
        e.preventDefault();
        if (isLastField) {
          handleSubmit(e);
        } else {
          handleNext();
        }
      }
    };

    document.addEventListener('keypress', handleKeyPress);
    return () => document.removeEventListener('keypress', handleKeyPress);
  }, [currentField, isLastField, handleNext]);

  // Handle submit
  const handleSubmit = useCallback(
    async (e) => {
      e?.preventDefault();

      if (!validateCurrentField()) {
        return;
      }

      setSubmitting(true);
      setSubmitError(null);

      try {
        const response = await fetch(`${restUrl}/submit`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            form_id: formId,
            data: values,
          }),
        });

        const result = await response.json();

        if (response.ok && result.success) {
          setSubmitSuccess(true);
          setValues({});
          setCurrentIndex(0);
        } else {
          setSubmitError(
            result.message || __('Submission failed.', 'subtleforms')
          );
        }
      } catch (err) {
        setSubmitError(__('Network error. Please try again.', 'subtleforms'));
      } finally {
        setSubmitting(false);
      }
    },
    [formId, values, validateCurrentField]
  );

  if (submitSuccess) {
    return (
      <div className='subtleforms-conversational'>
        <div className='subtleforms-conversational-success'>
          <div className='subtleforms-success-icon'>✓</div>
          <h2>{__('Thank you!', 'subtleforms')}</h2>
          <p>
            {__(
              'Your response has been submitted successfully.',
              'subtleforms'
            )}
          </p>
        </div>
      </div>
    );
  }

  if (totalFields === 0) {
    return (
      <div className='subtleforms-conversational'>
        <div className='subtleforms-empty'>
          <p>{__('This form has no questions.', 'subtleforms')}</p>
        </div>
      </div>
    );
  }

  const fieldKey = currentField?.config?.key || currentField?.key;
  const currentValue = values[fieldKey] || '';
  const currentError = validationErrors[fieldKey];

  return (
    <div className='subtleforms-conversational'>
      {/* Progress Bar */}
      <div className='subtleforms-progress'>
        <div className='subtleforms-progress-bar'>
          <div
            className='subtleforms-progress-fill'
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className='subtleforms-progress-text'>
          {Math.round(progressPercent)}% {__('Complete', 'subtleforms')}
        </div>
      </div>

      {/* Question Card */}
      <div className='subtleforms-question-card'>
        <div className='subtleforms-question-number'>
          {currentIndex + 1} / {totalFields}
        </div>

        {submitError && <div className='subtleforms-error'>{submitError}</div>}

        <div className='subtleforms-field-wrapper'>
          {currentField && (
            <FieldRenderer
              field={currentField}
              value={currentValue}
              onChange={(value) => handleChange(fieldKey, value)}
              error={currentError}
              hiddenFields={hiddenFields}
              autoFocus={true}
            />
          )}
        </div>

        {/* Navigation */}
        <div className='subtleforms-conversational-nav'>
          {currentIndex > 0 && (
            <button
              type='button'
              className='subtleforms-button subtleforms-button-prev'
              onClick={handlePrevious}
              disabled={submitting}>
              ← {__('Back', 'subtleforms')}
            </button>
          )}

          {isLastField ? (
            <button
              type='button'
              className='subtleforms-button subtleforms-button-submit'
              onClick={handleSubmit}
              disabled={submitting}>
              {submitting
                ? __('Submitting...', 'subtleforms')
                : __('Submit', 'subtleforms')}{' '}
              →
            </button>
          ) : (
            <button
              type='button'
              className='subtleforms-button subtleforms-button-next'
              onClick={handleNext}
              disabled={submitting}>
              {__('Next', 'subtleforms')} →
            </button>
          )}
        </div>

        {/* Hint */}
        <div className='subtleforms-hint'>
          {__('Press Enter ↵', 'subtleforms')}
        </div>
      </div>

      {/* Dot Navigation */}
      <div className='subtleforms-dots'>
        {visibleFields.map((field, index) => {
          const dotFieldKey = field.config?.key || field.key;
          return (
            <button
              key={dotFieldKey}
              type='button'
              onClick={() => {
                // Only allow jumping to previous fields
                if (index <= currentIndex) {
                  setCurrentIndex(index);
                }
              }}
              disabled={index > currentIndex}
              className={`subtleforms-dot ${
                index === currentIndex
                  ? 'active'
                  : index < currentIndex
                  ? 'completed'
                  : 'pending'
              }`}
              title={`${__('Question', 'subtleforms')} ${index + 1}`}
            />
          );
        })}
      </div>
    </div>
  );
}
