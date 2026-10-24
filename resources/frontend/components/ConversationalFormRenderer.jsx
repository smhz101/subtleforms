import { createSpamTokenSource } from '../utils/spamToken';
import { useState, useEffect, useCallback, useMemo, useRef } from '@wordpress/element';
import { currencySymbol as symbolFor, currencyDecimals } from '../../shared/currencies';
import { __, sprintf } from '@wordpress/i18n';
import FieldRenderer from './FieldRenderer';
import { getIn, setIn, flattenToPathMap } from '../utils/valuePaths';
import { collectLeafInputPaths } from '../utils/schemaLeaves';
import { warnOnce } from '../utils/warnOnce';
import { getFormClassNames } from '../utils/formStyles';
import {
  formAppearanceStyle,
  formAppearanceClasses,
} from '../../shared/appearance';
import { debug } from '../../shared/debug';
import { isEmptyValue } from './FormRenderer';
import { computeLogicState } from '../../shared/conditions';
import { FormContext } from './fields/contexts';
import { fieldConfig } from '../../shared/fieldConfig';
import { questionFields } from '../../shared/conversational';
import { formFieldDefaults, formHasRequiredFields, requiredIndicatorMark } from '../../shared/fieldDisplay';
import { collectDefaultValues } from '../utils/defaults';
import { validateFields } from '../utils/fieldValidation';

import { restFetch } from '../utils/restFetch';
import { announceSubmitted } from '../utils/submitted';
import { messageParagraphs } from '../../shared/safeLinks';
import ConfirmationText from './ConfirmationText';

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
  spamToken = '',
}) {
  const spamTokens = useMemo(() => createSpamTokenSource(formId), [formId]);
  const primeSpamToken = useCallback(() => spamTokens.prime(spamToken), [spamTokens, spamToken]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentStep, setCurrentStep] = useState('questions'); // 'questions', 'review', 'payment'
  const [values, setValues] = useState({});
  const [validationErrors, setValidationErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  // Confirmation chosen by the server (2.1: conditional confirmations).
  const [confirmation, setConfirmation] = useState(null);

  // Tell the page the form was sent (add-ons listen for it).
  useEffect(() => {
    if (submitSuccess && !preview) {
      announceSubmitted(formId);
    }
  }, [submitSuccess, preview, formId]);

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

  // The questions: the same list the builder shows (2.3.2). A Group or
  // Repeater is one question with its fields inside it.
  // Hidden tracking fields are not questions. Their values are still submitted.
  const trackingFields = useMemo(
    () => questionFields(schema?.fields || []).filter((field) => field?.type === 'hidden'),
    [schema]
  );
  const allFields = useMemo(
    () => questionFields(schema?.fields || []).filter((field) => field?.type !== 'hidden'),
    [schema]
  );
  const defaultValues = useMemo(
    () => collectDefaultValues(schema?.fields || []),
    [schema]
  );
  useEffect(() => {
    if (Object.keys(defaultValues).length > 0) {
      setValues((prev) => ({ ...defaultValues, ...prev }));
    }
  }, [defaultValues]);
  const fieldDefaults = useMemo(() => formFieldDefaults(schema?.metadata), [schema?.metadata]);

  // Generate form type-aware CSS classes (early, before any returns)
  // Conversational forms are rendered by this component rather than by
  // FormRenderer's main path, so appearance has to be resolved here too or a
  // preset would apply to every form type except this one.
  const appearance = schema?.metadata?.appearance;
  const formClassNames = [
    getFormClassNames(schema),
    formAppearanceClasses(appearance),
  ]
    .filter(Boolean)
    .join(' ');
  const appearanceStyle = formAppearanceStyle(appearance);

  // Conditional logic: the same evaluator as the server (shared/conditions.js).
  const hiddenFields = useMemo(
    () => new Set(computeLogicState(schema || {}, values).hidden_fields),
    [schema, values]
  );

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

  // Validate the current question with the same rules as the other form
  // types (2.3.2): its own required and validation messages, and every field
  // inside a Group or Repeater question.
  const validateCurrentField = useCallback(() => {
    if (!currentField) return true;
    const errors = validateFields([currentField], values, hiddenFields, fieldDefaults);
    const fieldKey = currentField.config?.key || currentField.key;
    setValidationErrors((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((k) => {
        if (k === fieldKey || (fieldKey && k.startsWith(`${fieldKey}.`))) delete next[k];
      });
      return { ...next, ...errors };
    });
    return Object.keys(errors).length === 0;
  }, [currentField, values, hiddenFields, fieldDefaults]);

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

  // The latest submit, and a lock so one entry is sent per submit even when
  // Enter on the focused Submit button fires both the click and the
  // keyboard shortcut (2.3.3).
  const submitRef = useRef(() => {});
  const submitLockRef = useRef(false);

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
        submitRef.current();
      }
    } else if (currentStep === 'payment') {
      // Submit from payment step
      submitRef.current();
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
  const handleSubmitOnce = useCallback(
    async (e) => {
      e?.preventDefault();

      if (preview && !Number(formId)) {
        setSubmitError(
          __('Save the form first, then submit the preview.', 'subtleforms')
        );
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
          debug(
            '[SubtleForms] Executing reCAPTCHA v3 with site key:',
            siteKey
          );

          // Execute reCAPTCHA v3 to get token
          const token = await window.grecaptcha.execute(siteKey, {
            action: 'submit',
          });
          debug(
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
      // Answers to hidden fields are not sent (the server drops them too).
      hiddenFields.forEach((k) => {
        delete payload[k];
      });

      // Include CAPTCHA response (v2 or v3)
      const recaptchaResponse = document.querySelector(
        'input[name="g-recaptcha-response"]'
      );
      if (recaptchaResponse && recaptchaResponse.value) {
        payload['g-recaptcha-response'] = recaptchaResponse.value;
        debug('[SubtleForms] Including g-recaptcha-response in payload');
      }

      const hcaptchaResponse = document.querySelector(
        'input[name="h-captcha-response"]'
      );
      if (hcaptchaResponse && hcaptchaResponse.value) {
        payload['h-captcha-response'] = hcaptchaResponse.value;
        debug('[SubtleForms] Including h-captcha-response in payload');
      }

      const turnstileResponse = document.querySelector(
        'input[name="cf-turnstile-response"]'
      );
      if (turnstileResponse && turnstileResponse.value) {
        payload['cf-turnstile-response'] = turnstileResponse.value;
        debug('[SubtleForms] Including cf-turnstile-response in payload');
      }

      try {
        const response = await restFetch('/submit', {
          method: 'POST',
          body: { form_id: formId, data: { ...payload, form_rendered_at: await spamTokens.take(spamToken) } },
        });

        const result = await response.json();

        if (response.ok && result?.data?.success) {
          const conf = result.data.confirmation || null;
          const fill = (text, encode = false) =>
            String(text || '').replace(/\{([\w.-]+)\}/g, (m, key) => {
              const raw = payload[key];
              if (raw === undefined || raw === null) return '';
              const str = Array.isArray(raw) ? raw.join(', ') : String(raw);
              return encode ? encodeURIComponent(str) : str;
            });
          if (conf?.type === 'redirect' && conf.redirectUrl && !preview) {
            window.location.assign(
              String(conf.redirectUrl).replace(/\{([\w.-]+)\}/g, (m, key) =>
                encodeURIComponent(payload[key] ?? '')
              )
            );
            return;
          }
          setConfirmation(
            conf && conf.type !== 'redirect'
              ? {
                  title: fill(conf.title),
                  message: fill(conf.message),
                  // Links are found in your own text first, then the answers are filled in.
                  paragraphs: messageParagraphs(conf.message, fill),
                }
              : null
          );
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
    [formId, values, leafPaths, preview, customOnSubmit, hiddenFields, spamToken, spamTokens]
  );

  const handleSubmit = useCallback(
    async (e) => {
      e?.preventDefault?.();
      if (submitLockRef.current) {
        return;
      }
      submitLockRef.current = true;
      try {
        await handleSubmitOnce(e);
      } finally {
        submitLockRef.current = false;
      }
    },
    [handleSubmitOnce]
  );
  submitRef.current = handleSubmit;

  if (submitSuccess) {
    return (
      <div className={formClassNames} style={appearanceStyle}>
        <div className='subtleforms-conversational-success'>
          <div className='subtleforms-success-icon'>✓</div>
          <h2>{confirmation?.title || __('Thank you!', 'subtleforms')}</h2>
          {confirmation?.paragraphs && confirmation.message ? (
            <ConfirmationText paragraphs={confirmation.paragraphs} />
          ) : (
            <p>
              {confirmation?.message ||
                __(
                  'Your response has been submitted successfully.',
                  'subtleforms'
                )}
            </p>
          )}
        </div>
      </div>
    );
  }

  const trackingInputs = trackingFields.map((field) => {
    const key = field.config?.key || field.key;
    if (!key) {
      return null;
    }
    return (
      <input
        key={key}
        type='hidden'
        name={key}
        value={getIn(values, key, '') ?? ''}
        readOnly
      />
    );
  });

  if (totalFields === 0) {
    return (
      <div className={formClassNames} style={appearanceStyle}>
        {trackingInputs}
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
  // A form without its own currency follows the site currency (PAY2-02).
  const currency = paymentSettings.currency || window.subtleformsFrontend?.currency || 'USD';
  const currencySymbol = symbolFor(currency);

  // Render Review Step
  if (currentStep === 'review') {
    return (
      <div className={formClassNames} style={appearanceStyle}>
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
              const label = fieldConfig(field).label || key;

              if (isEmptyValue(value)) return null;

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
      <div className={formClassNames} style={appearanceStyle}>
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
                {totalAmount.toFixed(currencyDecimals(currency))}
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
    <div className={formClassNames} style={appearanceStyle} onFocusCapture={primeSpamToken} onInputCapture={primeSpamToken}>
      {trackingInputs}
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

      {formHasRequiredFields(schema) && (
        <p className='subtleforms-required-legend'>
          <span className='subtleforms-required' aria-hidden='true'>
            {requiredIndicatorMark(fieldDefaults)}
          </span>
          {' '}
          {__('indicates required fields', 'subtleforms')}
        </p>
      )}

      {/* Question Card */}
      <div className='subtleforms-question-card'>
        <div className='subtleforms-question-number' aria-live='polite'>
          {sprintf(
            /* translators: 1: question number, 2: number of questions */
            __('Question %1$d of %2$d', 'subtleforms'),
            currentIndex + 1,
            totalFields
          )}
        </div>

        {submitError && <div className='subtleforms-error'>{submitError}</div>}

        <div className='subtleforms-field-wrapper'>
          {currentField && (
            <FormContext.Provider value={{ formId, preview, fieldDefaults }}>
              <FieldRenderer
                field={currentField}
                fieldPath={fieldKey}
                values={values}
                onChange={handleChange}
                errors={validationErrors}
                hiddenFields={hiddenFields}
                autoFocus={true}
              />
            </FormContext.Provider>
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
