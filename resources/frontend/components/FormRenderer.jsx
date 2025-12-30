import { useState, useEffect, useCallback, useMemo } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import FieldRenderer from './FieldRenderer';
import StepNavigation from './StepNavigation';
import ConversationalFormRenderer from './ConversationalFormRenderer';
import { getIn, setIn, flattenToPathMap } from '../utils/valuePaths';
import { collectLeafInputPaths } from '../utils/schemaLeaves';
import { warnOnce } from '../utils/warnOnce';

const restUrl =
  window.subtleformsFrontend?.restUrl || '/wp-json/subtleforms/v1';
const nonce = window.subtleformsFrontend?.nonce || '';

export default function FormRenderer({ formId }) {
  const [loading, setLoading] = useState(true);
  const [schema, setSchema] = useState(null);
  const [error, setError] = useState(null);
  const [values, setValues] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [validationErrors, setValidationErrors] = useState({});

  // Load schema
  useEffect(() => {
    fetch(`${restUrl}/forms/${formId}/schema`, {
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
  }, [formId]);

  // Extract steps from schema
  const steps = useMemo(() => {
    if (!schema?.fields) return [];
    return schema.fields.filter((f) => f.type === 'step');
  }, [schema]);

  const hasSteps = steps.length > 0;

  // Detect form type
  const formType = useMemo(
    () => schema?.metadata?.type || 'regular',
    [schema?.metadata?.type]
  );

  const isConversational = formType === 'conversational';
  const currentStep = hasSteps ? steps[currentStepIndex] : null;

  // Get fields to render
  const fieldsToRender = useMemo(() => {
    if (!schema?.fields) return [];

    if (hasSteps && currentStep) {
      // Show current step's children
      return currentStep.children || [];
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
        const hasChildren =
          Array.isArray(field.children) && field.children.length > 0;
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

        if (Array.isArray(field.children)) {
          visit(field.children);
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

      setValues((prev) => setIn(prev, path, value));

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
      hasSteps && currentStep ? currentStep.children || [] : fieldsToRender;

    const flattenForValidation = (fields) => {
      let result = [];
      fields.forEach((field) => {
        if (field.type !== 'step' && field.config?.key) {
          result.push(field);
        }
        if (field.children && Array.isArray(field.children)) {
          result = result.concat(flattenForValidation(field.children));
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
  const handleNextStep = useCallback(() => {
    if (!validateStep()) {
      return;
    }

    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentStepIndex, steps, validateStep]);

  const handlePrevStep = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentStepIndex]);

  // Handle form submission
  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();

      if (!validateStep()) {
        return;
      }

      setSubmitting(true);
      setSubmitError(null);

      const flatValues = flattenToPathMap(values);
      const payload = {};

      leafPaths.forEach((path) => {
        if (Object.prototype.hasOwnProperty.call(flatValues, path)) {
          payload[path] = flatValues[path];
        }
      });

      try {
        const response = await fetch(`${restUrl}/submit`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            form_id: formId,
            data: payload,
          }),
        });

        const result = await response.json();

        if (response.ok && result.success) {
          setSubmitSuccess(true);
          setValues({});
          setCurrentStepIndex(0);
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
    [formId, values, validateStep, leafPaths]
  );

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
    return <ConversationalFormRenderer schema={schema} formId={formId} />;
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

  return (
    <div className='subtleforms-form'>
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
            <button
              type='button'
              className='subtleforms-button subtleforms-button-next'
              onClick={handleNextStep}>
              {__('Next', 'subtleforms')}
            </button>
          ) : (
            <button
              type='submit'
              className='subtleforms-button subtleforms-button-submit'
              disabled={submitting}>
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
