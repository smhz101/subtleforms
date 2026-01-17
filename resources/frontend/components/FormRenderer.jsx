import { useState, useEffect, useCallback, useMemo } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import FieldRenderer from './FieldRenderer';
import StepNavigation from './StepNavigation';
import ConversationalFormRenderer from './ConversationalFormRenderer';
import { getIn, setIn, flattenToPathMap } from '../utils/valuePaths';
import { collectLeafInputPaths } from '../utils/schemaLeaves';
import { warnOnce } from '../utils/warnOnce';
import { getFormClassNames } from '../utils/formStyles';

const restUrl =
  window.subtleformsFrontend?.restUrl || '/wp-json/subtleforms/v1';
const nonce = window.subtleformsFrontend?.nonce || '';

export default function FormRenderer({
  formId,
  preloadedSchema = null,
  preview = false,
  onSubmit: customOnSubmit = null,
}) {
  const [loading, setLoading] = useState(!preloadedSchema);
  const [schema, setSchema] = useState(preloadedSchema);
  const [error, setError] = useState(null);
  const [values, setValues] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [validationErrors, setValidationErrors] = useState({});
  const [isSubmitIntentional, setIsSubmitIntentional] = useState(false);

  // Load schema (skip if preloaded)
  useEffect(() => {
    // Set render time for spam protection time trap
    if (!window.subtleformsRenderTime) {
      window.subtleformsRenderTime = Math.floor(Date.now() / 1000);
    }

    if (preloadedSchema) {
      setLoading(false);
      return;
    }

    fetch(`${restUrl.replace(/\/$/, '')}/forms/${formId}/schema`, {
      credentials: 'same-origin',
      headers: {
        'X-WP-Nonce': nonce,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.schema) {
          setSchema(data.schema);
        } else {
          setError(__('Failed to load form.', 'subtleforms'));
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(__('Failed to load form.', 'subtleforms'));
        setLoading(false);
      });
  }, [formId, preloadedSchema]);

  // Extract steps from schema
  // Detect form type from metadata
  const formType = useMemo(
    () => schema?.metadata?.type || 'regular',
    [schema?.metadata?.type]
  );

  const isMultistep =
    formType === 'multistep' ||
    formType === 'multi-step' ||
    formType === 'steps';
  const isConversational = formType === 'conversational';

  const steps = useMemo(() => {
    if (!schema?.fields) return [];

    // First check if there are explicit step fields
    const stepFields = schema.fields.filter((f) => f.type === 'step');
    if (stepFields.length > 0) {
      return stepFields;
    }

    // If form is marked as multistep but has no step fields,
    // treat field groups or sections as steps
    if (isMultistep) {
      const fieldGroups = schema.fields.filter(
        (f) => f.type === 'fieldGroup' || f.type === 'section'
      );
      if (fieldGroups.length > 0) {
        return fieldGroups;
      }
      // If no field groups either, create a single step with all fields
      return [
        {
          type: 'step',
          id: 'step-1',
          config: { label: schema.metadata?.title || 'Form' },
          fields: schema.fields,
        },
      ];
    }

    return [];
  }, [schema, isMultistep]);

  const hasSteps = steps.length > 0;
  const currentStep = hasSteps ? steps[currentStepIndex] : null;

  // Get fields to render
  const fieldsToRender = useMemo(() => {
    if (!schema?.fields) return [];

    if (hasSteps && currentStep) {
      // Show current step's children (or fields for backward compat)
      // Check length because empty array is truthy
      const children =
        currentStep.children?.length > 0 ? currentStep.children : null;
      const fields = currentStep.fields?.length > 0 ? currentStep.fields : null;
      return children || fields || [];
    }

    // Show all non-step fields
    return schema.fields.filter((f) => f.type !== 'step');
  }, [schema, currentStep, hasSteps]);

  // Flatten all fields for conditional logic
  const allFields = useMemo(() => {
    if (!schema?.fields) return [];

    const flatten = (fields) => {
      let result = [];
      fields.forEach((field) => {
        if (field.type !== 'step') {
          result.push(field);
        }
        // Support both children and fields properties
        const childFields = field.children || field.fields;
        if (childFields && Array.isArray(childFields)) {
          result = result.concat(flatten(childFields));
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

  const containerPaths = useMemo(() => {
    const paths = new Set();
    if (!schema?.fields) {
      return paths;
    }

    const visit = (nodes) => {
      if (!Array.isArray(nodes)) {
        return;
      }

      nodes.forEach((field) => {
        if (!field || typeof field !== 'object') {
          return;
        }

        const key = field.config?.key || field.key;
        const childFields = field.children || field.fields;
        const hasChildren =
          Array.isArray(childFields) && childFields.length > 0;
        const hasColumns =
          Array.isArray(field.columns) && field.columns.length > 0;
        const isColumnContainer =
          typeof field.type === 'string' &&
          field.type.includes('_column_container');
        const isContainerType =
          field.type === 'group_container' ||
          field.type === 'repeat_container' ||
          field.type === 'step' ||
          field.type === 'section' ||
          isColumnContainer;

        if (
          (hasChildren || hasColumns || isContainerType) &&
          typeof key === 'string' &&
          key.trim()
        ) {
          paths.add(key);
        }

        const childFieldsToVisit = field.children || field.fields;
        if (Array.isArray(childFieldsToVisit)) {
          visit(childFieldsToVisit);
        }

        if (Array.isArray(field.columns)) {
          field.columns.forEach((col) => {
            if (Array.isArray(col)) {
              visit(col);
            }
          });
        }
      });
    };

    visit(schema.fields);
    return paths;
  }, [schema]);

  const leafPaths = useMemo(() => {
    const paths = collectLeafInputPaths(schema?.fields || []);

    console.log('[SubtleForms] Leaf Paths Calculation:', {
      schemaFields: schema?.fields,
      schemaFieldsCount: (schema?.fields || []).length,
      hasSteps: hasSteps,
      stepsCount: steps.length,
      calculatedPaths: paths,
      pathsCount: paths.length,
    });

    // Dev-only: detect duplicates.
    const seen = new Set();
    const dupes = new Set();
    paths.forEach((p) => {
      if (seen.has(p)) {
        dupes.add(p);
      }
      seen.add(p);
    });

    if (dupes.size > 0) {
      warnOnce(
        `subtleforms:duplicate-leaf-paths:${Array.from(dupes).join(',')}`,
        '[SubtleForms] Duplicate field paths detected in schema (leaf keys must be unique):',
        Array.from(dupes)
      );
    }

    return paths;
  }, [schema]);

  // Evaluate conditional logic (show/hide only)
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

  // Handle field change
  const handleChange = useCallback(
    (path, value) => {
      if (typeof path !== 'string' || !path.trim()) {
        warnOnce(
          'subtleforms:missing-field-path',
          '[SubtleForms] Field attempted to write without a path. Ignoring update.'
        );
        return;
      }

      if (containerPaths.has(path)) {
        warnOnce(
          `subtleforms:container-write:${path}`,
          '[SubtleForms] Container field attempted to write a value. This is a bug; ignoring update.',
          { path }
        );
        return;
      }

      setValues((prev) => {
        const newValues = setIn(prev, path, value);
        console.log('[SubtleForms] Value Update:', {
          path: path,
          value: value,
          previousValues: prev,
          newValues: newValues,
          currentStepIndex: currentStepIndex,
        });
        return newValues;
      });

      // Clear validation error for this field
      setValidationErrors((prev) => {
        if (!prev || typeof prev !== 'object') {
          return prev;
        }
        if (!prev[path]) {
          return prev;
        }
        const next = { ...prev };
        delete next[path];
        return next;
      });
    },
    [containerPaths]
  );

  // Validate current step
  const validateStep = useCallback(() => {
    const errors = {};
    const fieldsOnCurrentStep =
      hasSteps && currentStep
        ? (currentStep.children?.length > 0
            ? currentStep.children
            : currentStep.fields) || []
        : fieldsToRender;

    const flattenForValidation = (fields) => {
      let result = [];
      fields.forEach((field) => {
        if (field.type !== 'step' && field.config?.key) {
          result.push(field);
        }
        const childFields = field.children || field.fields;
        if (childFields && Array.isArray(childFields)) {
          result = result.concat(flattenForValidation(childFields));
        }
        if (field.columns && Array.isArray(field.columns)) {
          field.columns.forEach((col) => {
            if (Array.isArray(col)) {
              result = result.concat(flattenForValidation(col));
            }
          });
        }
      });
      return result;
    };

    const fields = flattenForValidation(fieldsOnCurrentStep);

    fields.forEach((field) => {
      const fieldKey = field.config?.key || field.key;

      // Skip hidden fields
      if (hiddenFields.has(fieldKey)) {
        return;
      }

      const value = getIn(values, fieldKey);
      const isRequired = field.config?.required;

      if (isRequired && (!value || value === '')) {
        errors[fieldKey] = __('This field is required.', 'subtleforms');
      }

      // Type validation
      if (value && value !== '') {
        if (
          field.type === 'email' &&
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
        ) {
          errors[fieldKey] = __('Invalid email address.', 'subtleforms');
        }
        if (field.type === 'url' && !/^https?:\/\/.+/.test(value)) {
          errors[fieldKey] = __('Invalid URL.', 'subtleforms');
        }
      }
    });

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [hasSteps, currentStep, fieldsToRender, hiddenFields, values]);

  // Handle step navigation
  // IMPORTANT: Step navigation NEVER triggers submission
  // This is intentional to prevent accidental form submission
  const handleNextStep = useCallback(() => {
    console.log('[SubtleForms] Next Step:', {
      currentStepIndex: currentStepIndex,
      currentValues: values,
      valuesKeys: Object.keys(values),
    });

    if (!validateStep()) {
      return;
    }

    // Only advance to next step, never submit
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // DEFENSIVE: Explicitly do NOT call handleSubmit here
    // Multi-step forms should only submit when user clicks Submit button
  }, [currentStepIndex, steps, validateStep, values]);

  const handlePrevStep = useCallback(() => {
    console.log('[SubtleForms] Prev Step:', {
      currentStepIndex: currentStepIndex,
      currentValues: values,
      valuesKeys: Object.keys(values),
    });

    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentStepIndex, values]);

  // Handle form submission
  // SUBMISSION GUARD: Only submit when explicitly requested via Submit button
  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();

      // GUARD: Prevent accidental submission from navigation or other sources
      if (!isSubmitIntentional && hasSteps) {
        console.warn(
          '[SubtleForms] Submission blocked: Not triggered by Submit button'
        );
        return;
      }

      // Reset intent flag after checking
      if (isSubmitIntentional) {
        setIsSubmitIntentional(false);
      }

      // In preview mode, prevent submission
      if (preview) {
        console.warn('SubtleForms: Form submission disabled in preview mode');
        if (customOnSubmit) {
          customOnSubmit();
        }
        return;
      }

      // For submission, validate all required fields across all steps, not just current step
      const validateAllSteps = () => {
        if (!hasSteps) {
          return validateStep(); // For non-step forms, use normal validation
        }

        const errors = {};

        // Get all fields from all steps
        const allStepFields = [];
        steps.forEach((step) => {
          const stepFields = step.children || step.fields || [];
          allStepFields.push(...stepFields);
        });

        const flattenForValidation = (fields) => {
          let result = [];
          fields.forEach((field) => {
            if (field.type !== 'step' && field.config?.key) {
              result.push(field);
            }
            const childFields = field.children || field.fields;
            if (childFields && Array.isArray(childFields)) {
              result = result.concat(flattenForValidation(childFields));
            }
            if (field.columns && Array.isArray(field.columns)) {
              field.columns.forEach((col) => {
                if (Array.isArray(col)) {
                  result = result.concat(flattenForValidation(col));
                }
              });
            }
          });
          return result;
        };

        const allFields = flattenForValidation(allStepFields);

        allFields.forEach((field) => {
          const fieldKey = field.config?.key || field.key;

          // Skip hidden fields
          if (hiddenFields.has(fieldKey)) {
            return;
          }

          const value = getIn(values, fieldKey);
          const isRequired = field.config?.required;

          if (isRequired && (!value || value === '')) {
            errors[fieldKey] = __('This field is required.', 'subtleforms');
          }

          // Type validation
          if (value && value !== '') {
            if (
              field.type === 'email' &&
              !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
            ) {
              errors[fieldKey] = __('Invalid email address.', 'subtleforms');
            }
            if (field.type === 'url' && !/^https?:\/\/.+/.test(value)) {
              errors[fieldKey] = __('Invalid URL.', 'subtleforms');
            }
          }
        });

        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
      };

      if (!validateAllSteps()) {
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
        }
      });

      // Debug logging for empty submissions
      console.log('[SubtleForms] Submission Debug:', {
        leafPathsCount: leafPaths.length,
        leafPaths: leafPaths,
        valuesKeys: Object.keys(values),
        values: values,
        flatValuesKeys: Object.keys(flatValues),
        flatValues: flatValues,
        payloadKeys: Object.keys(payload),
        payload: payload,
        hasSteps: hasSteps,
        currentStepIndex: currentStepIndex,
        totalSteps: steps.length,
        stepsInfo: steps.map((step) => ({
          type: step.type,
          id: step.id,
          title: step.config?.title || step.config?.label,
          childrenCount: (step.children || step.fields || []).length,
        })),
      });

      try {
        // Add honeypot and time trap fields to payload
        const submissionPayload = {
          ...payload,
          website_url: '', // Honeypot field (should always be empty)
          form_rendered_at:
            window.subtleformsRenderTime || Math.floor(Date.now() / 1000),
        };

        // Include CAPTCHA response (v2 or v3)
        const recaptchaResponse = document.querySelector(
          'input[name="g-recaptcha-response"]'
        );
        if (recaptchaResponse && recaptchaResponse.value) {
          submissionPayload['g-recaptcha-response'] = recaptchaResponse.value;
          console.log(
            '[SubtleForms] Including g-recaptcha-response in payload'
          );
        }

        const hcaptchaResponse = document.querySelector(
          'input[name="h-captcha-response"]'
        );
        if (hcaptchaResponse && hcaptchaResponse.value) {
          submissionPayload['h-captcha-response'] = hcaptchaResponse.value;
          console.log('[SubtleForms] Including h-captcha-response in payload');
        }

        const turnstileResponse = document.querySelector(
          'input[name="cf-turnstile-response"]'
        );
        if (turnstileResponse && turnstileResponse.value) {
          submissionPayload['cf-turnstile-response'] = turnstileResponse.value;
          console.log(
            '[SubtleForms] Including cf-turnstile-response in payload'
          );
        }

        const response = await fetch(`${restUrl.replace(/\/$/, '')}/submit`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'Content-Type': 'application/json',
            'X-WP-Nonce': nonce,
          },
          body: JSON.stringify({
            form_id: formId,
            data: submissionPayload,
          }),
        });

        const result = await response.json();

        if (response.ok && result.success) {
          setSubmitSuccess(true);
          setValues({});
          setCurrentStepIndex(0);

          if (customOnSubmit) {
            customOnSubmit(result);
          }
        } else {
          // If backend returned structured field errors, store them for per-field display.
          const errors = result?.data?.errors || result?.errors;
          if (errors && typeof errors === 'object') {
            setValidationErrors(errors);
          }
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
    [
      formId,
      values,
      validateStep,
      leafPaths,
      preview,
      customOnSubmit,
      isSubmitIntentional,
      hasSteps,
    ]
  );

  // Handle explicit submit button click
  // Sets intent flag before form submission
  const handleExplicitSubmit = useCallback(() => {
    setIsSubmitIntentional(true);
    // Form onSubmit will be triggered naturally by button type="submit"
  }, []);

  if (loading) {
    return (
      <div className='subtleforms-loading'>
        {__('Loading form...', 'subtleforms')}
      </div>
    );
  }

  if (error) {
    return <div className='subtleforms-error'>{error}</div>;
  }

  // Use conversational renderer for conversational forms
  if (isConversational) {
    return (
      <ConversationalFormRenderer
        schema={schema}
        formId={formId}
        preview={preview}
        onSubmit={customOnSubmit}
      />
    );
  }

  if (submitSuccess) {
    return (
      <div className='subtleforms-success'>
        <h3>{__('Thank you!', 'subtleforms')}</h3>
        <p>{__('Your form has been submitted successfully.', 'subtleforms')}</p>
      </div>
    );
  }

  const isLastStep = !hasSteps || currentStepIndex === steps.length - 1;

  // Generate form type-aware CSS classes
  const formClassNames = getFormClassNames(schema);

  return (
    <div className={formClassNames}>
      {schema.metadata?.title && (
        <h2 className='subtleforms-form-title'>{schema.metadata.title}</h2>
      )}

      {hasSteps && (
        <StepNavigation
          steps={steps}
          currentStepIndex={currentStepIndex}
          onStepClick={(index) => {
            // Allow clicking on completed steps
            if (index <= currentStepIndex) {
              setCurrentStepIndex(index);
            }
          }}
        />
      )}

      <form onSubmit={handleSubmit}>
        {submitError && <div className='subtleforms-error'>{submitError}</div>}

        <div className='subtleforms-step-content'>
          {currentStep?.config?.label && (
            <h3 className='subtleforms-step-title-main'>
              {currentStep.config.label}
            </h3>
          )}
          {currentStep?.config?.description && (
            <p className='subtleforms-step-description'>
              {currentStep.config.description}
            </p>
          )}

          {fieldsToRender.map((field) => {
            const fieldKey = field.config?.key || field.key;

            if (hiddenFields.has(fieldKey)) {
              return null;
            }

            return (
              <FieldRenderer
                key={fieldKey}
                field={field}
                fieldPath={fieldKey}
                values={values}
                onChange={handleChange}
                errors={validationErrors}
                hiddenFields={hiddenFields}
              />
            );
          })}
        </div>

        <div className='subtleforms-buttons'>
          {hasSteps && currentStepIndex > 0 && (
            <button
              type='button'
              className='subtleforms-button subtleforms-button-prev'
              onClick={handlePrevStep}>
              {__('Previous', 'subtleforms')}
            </button>
          )}

          {hasSteps && !isLastStep ? (
            // Multi-step: Show Next button (does NOT submit)
            <button
              type='button'
              className='subtleforms-button subtleforms-button-next'
              onClick={handleNextStep}>
              {__('Next', 'subtleforms')}
            </button>
          ) : (
            // Final step or single-page: Show Submit button (DOES submit)
            <button
              type='submit'
              className='subtleforms-button subtleforms-button-submit'
              disabled={submitting}
              onClick={handleExplicitSubmit}>
              {submitting
                ? __('Submitting...', 'subtleforms')
                : __('Submit', 'subtleforms')}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
