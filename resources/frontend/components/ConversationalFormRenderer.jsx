import { useState, useEffect, useCallback, useMemo } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import FieldRenderer from './FieldRenderer';
import { getIn, setIn, flattenToPathMap } from '../utils/valuePaths';
import { collectLeafInputPaths } from '../utils/schemaLeaves';
import { warnOnce } from '../utils/warnOnce';
import { getFormClassNames } from '../utils/formStyles';

const restUrl =
  window.subtleformsFrontend?.restUrl || '/wp-json/subtleforms/v1';
const nonce = window.subtleformsFrontend?.nonce || '';

/**
 * ConversationalFormRenderer - Renders form one question at a time
 *
 * Displays fields sequentially with smooth transitions and per-field validation
 * Supports payment flow: Questions → Review → Payment → Submit
 */
export default function ConversationalFormRenderer({
  schema,
  formId,
  preview = false,
  onSubmit: customOnSubmit = null,
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentStep, setCurrentStep] = useState('questions'); // 'questions', 'review', 'payment'
  const [values, setValues] = useState({});
  const [validationErrors, setValidationErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const leafPaths = useMemo(
    () => collectLeafInputPaths(schema?.fields || []),
    [schema]
  );

  // Check if payment is enabled
  const paymentEnabled =
    schema?.metadata?.payment?.enabled === true &&
    (schema?.metadata?.type === 'payment' ||
      schema?.metadata?.type === 'conversational');

  const paymentSettings = schema?.metadata?.payment || {};

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

  // Generate form type-aware CSS classes (early, before any returns)
  const formClassNames = getFormClassNames(schema);

  // Evaluate conditional logic
  const hiddenFields = useMemo(() => {
    const hidden = new Set();

    allFields.forEach((field) => {
      const conditions = field.config?.conditions || [];

      conditions.forEach((condition) => {
        const sourceValue = getIn(values, condition.sourceField);
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
  const progressPercent =
    totalFields > 0 ? ((currentIndex + 1) / totalFields) * 100 : 0;

  // Validate current field
  const validateCurrentField = useCallback(() => {
    if (!currentField) return true;

    const fieldKey = currentField.config?.key || currentField.key;
    const value = getIn(values, fieldKey);
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
  const handleChange = useCallback((path, value) => {
    if (typeof path !== 'string' || !path.trim()) {
      warnOnce(
        'subtleforms:missing-field-path:conversational',
        '[SubtleForms] Field attempted to write without a path. Ignoring update.'
      );
      return;
    }

    setValues((prev) => setIn(prev, path, value));

    // Clear validation error when user types
    setValidationErrors((prev) => {
      const next = { ...prev };
      delete next[path];
      return next;
    });
  }, []);

  // Handle next
  const handleNext = useCallback(() => {
    if (currentStep === 'questions') {
      if (!validateCurrentField()) {
        return;
      }

      if (currentIndex < totalFields - 1) {
        setCurrentIndex((prev) => prev + 1);
      } else {
        // Last question - move to review step
        setCurrentStep('review');
      }
    } else if (currentStep === 'review') {
      // Move to payment or submit
      if (paymentEnabled) {
        setCurrentStep('payment');
      } else {
        handleSubmit();
      }
    } else if (currentStep === 'payment') {
      // Submit from payment step
      handleSubmit();
    }
  }, [
    currentStep,
    validateCurrentField,
    currentIndex,
    totalFields,
    paymentEnabled,
  ]);

  // Handle previous
  const handlePrevious = useCallback(() => {
    if (currentStep === 'review') {
      // Go back to last question
      setCurrentStep('questions');
      setCurrentIndex(totalFields - 1);
    } else if (currentStep === 'payment') {
      // Go back to review
      setCurrentStep('review');
    } else if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  }, [currentStep, currentIndex, totalFields]);

  // Handle Enter key to advance
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (
        e.key === 'Enter' &&
        !e.shiftKey &&
        currentField?.type !== 'textarea'
      ) {
        e.preventDefault();
        if (currentStep === 'questions' && currentIndex === totalFields - 1) {
          // Last question - go to review
          handleNext();
        } else if (currentStep === 'questions') {
          handleNext();
        } else if (currentStep === 'review' || currentStep === 'payment') {
          handleNext();
        }
      }
    };

    document.addEventListener('keypress', handleKeyPress);
    return () => document.removeEventListener('keypress', handleKeyPress);
  }, [currentField, currentStep, currentIndex, totalFields, handleNext]);

  // Handle submit
  const handleSubmit = useCallback(
    async (e) => {
      e?.preventDefault();

      // In preview mode, prevent submission
      if (preview) {
        console.warn('SubtleForms: Form submission disabled in preview mode');
        if (customOnSubmit) {
          customOnSubmit();
        }
        return;
      }

      setSubmitting(true);
      setSubmitError(null);

      // Handle reCAPTCHA v3 if present
      const recaptchaV3Input = document.querySelector(
        '.subtleforms-recaptcha-v3'
      );
      if (recaptchaV3Input && window.grecaptcha && window.grecaptcha.execute) {
        try {
          const siteKey = recaptchaV3Input.getAttribute('data-sitekey');
          console.log(
            '[SubtleForms] Executing reCAPTCHA v3 with site key:',
            siteKey
          );

          // Execute reCAPTCHA v3 to get token
          const token = await window.grecaptcha.execute(siteKey, {
            action: 'submit',
          });
          console.log(
            '[SubtleForms] reCAPTCHA v3 token obtained:',
            token ? 'YES' : 'NO'
          );

          // Set the token in the hidden input
          recaptchaV3Input.value = token;
        } catch (error) {
          console.error('[SubtleForms] reCAPTCHA v3 execution failed:', error);
          setSubmitError(
            __('CAPTCHA verification failed. Please try again.', 'subtleforms')
          );
          setSubmitting(false);
          return;
        }
      }

      const flatValues = flattenToPathMap(values);
      const payload = {};
      leafPaths.forEach((path) => {
        if (Object.prototype.hasOwnProperty.call(flatValues, path)) {
          payload[path] = flatValues[path];
        } else {
          // For array values (e.g. multiple_choice with allowMultiple) flattenToPathMap
          // expands them to indexed keys (path.0, path.1, …) so the root key won't
          // appear in flatValues. Fall back to reading the value directly from state.
          const directValue = getIn(values, path);
          if (directValue !== undefined) {
            payload[path] = directValue;
          }
        }
      });

      // Include CAPTCHA response (v2 or v3)
      const recaptchaResponse = document.querySelector(
        'input[name="g-recaptcha-response"]'
      );
      if (recaptchaResponse && recaptchaResponse.value) {
        payload['g-recaptcha-response'] = recaptchaResponse.value;
        console.log('[SubtleForms] Including g-recaptcha-response in payload');
      }

      const hcaptchaResponse = document.querySelector(
        'input[name="h-captcha-response"]'
      );
      if (hcaptchaResponse && hcaptchaResponse.value) {
        payload['h-captcha-response'] = hcaptchaResponse.value;
        console.log('[SubtleForms] Including h-captcha-response in payload');
      }

      const turnstileResponse = document.querySelector(
        'input[name="cf-turnstile-response"]'
      );
      if (turnstileResponse && turnstileResponse.value) {
        payload['cf-turnstile-response'] = turnstileResponse.value;
        console.log('[SubtleForms] Including cf-turnstile-response in payload');
      }

      try {
        const response = await fetch(`${restUrl}submit`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'Content-Type': 'application/json',
            'X-WP-Nonce': nonce,
          },
          body: JSON.stringify({
            form_id: formId,
            data: payload,
          }),
        });

        const result = await response.json();

        if (response.ok && result?.data?.success) {
          setSubmitSuccess(true);
          setValues({});
          setCurrentIndex(0);
          setCurrentStep('questions');

          if (customOnSubmit) {
            customOnSubmit(result.data);
          }
        } else {
          setSubmitError(
            result?.error?.message || result?.data?.message || __('Submission failed.', 'subtleforms')
          );
        }
      } catch (err) {
        setSubmitError(__('Network error. Please try again.', 'subtleforms'));
      } finally {
        setSubmitting(false);
      }
    },
    [formId, values, leafPaths, preview, customOnSubmit]
  );

  if (submitSuccess) {
    return (
      <div className={formClassNames}>
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
      <div className={formClassNames}>
        <div className='subtleforms-empty'>
          <p>{__('This form has no questions.', 'subtleforms')}</p>
        </div>
      </div>
    );
  }

  const fieldKey = currentField?.config?.key || currentField?.key;
  const currentValue = getIn(values, fieldKey, '') || '';
  const currentError = validationErrors[fieldKey];

  // Calculate total payment amount
  const calculateTotal = () => {
    if (paymentSettings.amountType === 'fixed') {
      return parseFloat(paymentSettings.fixedAmount || 0);
    } else if (paymentSettings.amountType === 'field') {
      const amountField = paymentSettings.amountField;
      return parseFloat(values[amountField] || 0);
    }
    return 0;
  };

  const totalAmount = calculateTotal();
  const currency = paymentSettings.currency || 'USD';
  const currencySymbol =
    currency === 'USD'
      ? '$'
      : currency === 'EUR'
      ? '€'
      : currency === 'GBP'
      ? '£'
      : currency;

  // Render Review Step
  if (currentStep === 'review') {
    return (
      <div className={formClassNames}>
        {/* Progress indicator */}
        <div className='subtleforms-progress'>
          <div className='subtleforms-progress-bar'>
            <div
              className='subtleforms-progress-fill'
              style={{ width: '90%' }}
            />
          </div>
          <div className='subtleforms-progress-text'>
            {__('Review Your Answers', 'subtleforms')}
          </div>
        </div>

        <div className='subtleforms-review-card'>
          <h2 className='subtleforms-review-title'>
            {__('Please review your answers', 'subtleforms')}
          </h2>

          {submitError && (
            <div className='subtleforms-error'>{submitError}</div>
          )}

          <div className='subtleforms-review-list'>
            {visibleFields.map((field, index) => {
              const key = field.config?.key || field.key;
              const value = values[key];
              const label = field.config?.label || field.label || key;

              if (!value || value === '') return null;

              return (
                <div key={key} className='subtleforms-review-item'>
                  <div className='subtleforms-review-label'>{label}</div>
                  <div className='subtleforms-review-value'>
                    {Array.isArray(value) ? value.join(', ') : String(value)}
                  </div>
                  <button
                    type='button'
                    className='subtleforms-review-edit'
                    onClick={() => {
                      setCurrentStep('questions');
                      setCurrentIndex(index);
                    }}>
                    {__('Edit', 'subtleforms')}
                  </button>
                </div>
              );
            })}
          </div>

          <div className='subtleforms-conversational-nav'>
            <button
              type='button'
              className='subtleforms-button subtleforms-button-prev'
              onClick={handlePrevious}
              disabled={submitting}>
              ← {__('Back', 'subtleforms')}
            </button>

            <button
              type='button'
              className='subtleforms-button subtleforms-button-next'
              onClick={handleNext}
              disabled={submitting}>
              {paymentEnabled
                ? __('Continue to Payment', 'subtleforms')
                : __('Submit', 'subtleforms')}{' '}
              →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render Payment Step
  if (currentStep === 'payment') {
    return (
      <div className={formClassNames}>
        {/* Progress indicator */}
        <div className='subtleforms-progress'>
          <div className='subtleforms-progress-bar'>
            <div
              className='subtleforms-progress-fill'
              style={{ width: '95%' }}
            />
          </div>
          <div className='subtleforms-progress-text'>
            {__('Payment', 'subtleforms')}
          </div>
        </div>

        <div className='subtleforms-payment-card'>
          <h2 className='subtleforms-payment-title'>
            {__('Complete Payment', 'subtleforms')}
          </h2>

          {submitError && (
            <div className='subtleforms-error'>{submitError}</div>
          )}

          <div className='subtleforms-payment-summary'>
            <div className='subtleforms-payment-amount'>
              <span className='subtleforms-payment-label'>
                {__('Amount Due:', 'subtleforms')}
              </span>
              <span className='subtleforms-payment-value'>
                {currencySymbol}
                {totalAmount.toFixed(2)}
              </span>
            </div>

            {paymentSettings.mode === 'test' && (
              <div className='subtleforms-payment-test-notice'>
                {__(
                  '⚠️ Test Mode: No actual payment will be processed',
                  'subtleforms'
                )}
              </div>
            )}

            <div className='subtleforms-payment-gateway-placeholder'>
              <p className='subtleforms-payment-info'>
                {__(
                  'Payment gateway integration will appear here. For now, click Submit to complete the form.',
                  'subtleforms'
                )}
              </p>
            </div>
          </div>

          <div className='subtleforms-conversational-nav'>
            <button
              type='button'
              className='subtleforms-button subtleforms-button-prev'
              onClick={handlePrevious}
              disabled={submitting}>
              ← {__('Back to Review', 'subtleforms')}
            </button>

            <button
              type='button'
              className='subtleforms-button subtleforms-button-submit'
              onClick={handleSubmit}
              disabled={submitting}>
              {submitting
                ? __('Processing...', 'subtleforms')
                : __('Complete Submission', 'subtleforms')}{' '}
              →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render Questions Step (default)
  return (
    <div className={formClassNames}>
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
              fieldPath={fieldKey}
              values={values}
              onChange={handleChange}
              errors={validationErrors}
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

          <button
            type='button'
            className='subtleforms-button subtleforms-button-next'
            onClick={handleNext}
            disabled={submitting}>
            {currentIndex === totalFields - 1
              ? __('Review', 'subtleforms')
              : __('Next', 'subtleforms')}{' '}
            →
          </button>
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
                if (index <= currentIndex && currentStep === 'questions') {
                  setCurrentIndex(index);
                }
              }}
              disabled={index > currentIndex || currentStep !== 'questions'}
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
