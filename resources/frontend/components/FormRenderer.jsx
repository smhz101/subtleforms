import { useState, useEffect, useCallback, useMemo, useRef } from '@wordpress/element';
import { __, sprintf, _n } from '@wordpress/i18n';
import FieldRenderer from './FieldRenderer';
import StepNavigation from './StepNavigation';
import ConversationalFormRenderer from './ConversationalFormRenderer';
import { getIn, setIn, flattenToPathMap } from '../utils/valuePaths';
import { collectLeafInputPaths, collectContainerKeys } from '../utils/schemaLeaves';
import { collectDefaultValues } from '../utils/defaults';
import { evaluateFormula } from '../utils/formula';
import {
  validateFields,
} from '../utils/fieldValidation';
import { warnOnce } from '../utils/warnOnce';
import { getFormClassNames } from '../utils/formStyles';
import { debug } from '../../shared/debug';
import {
  formAppearanceStyle,
  formAppearanceClasses,
  getPreset,
} from '../../shared/appearance';

const restUrl =
  window.subtleformsFrontend?.restUrl || '/wp-json/subtleforms/v1';
const nonce = window.subtleformsFrontend?.nonce || '';

/**
 * Whether a submitted value counts as missing.
 *
 * Numeric zero is a real answer: a range slider at a minimum of 0, an NPS score
 * of 0, a number field holding 0. A plain falsy test rejects all three and makes
 * the lowest option on those fields impossible to submit.
 *
 * An unchecked checkbox stays "empty" — a required checkbox means it must be
 * ticked, so `false` is genuinely missing there.
 */
export const isEmptyValue = ( value ) =>
  value === undefined ||
  value === null ||
  value === '' ||
  value === false ||
  ( Array.isArray( value ) && value.length === 0 );

export default function FormRenderer({
  formId,
  preloadedSchema = null,
  preview = false,
  onSubmit: customOnSubmit = null,
  blockOptions = null,
}) {
  const [loading, setLoading] = useState(!preloadedSchema);
  const [schema, setSchema] = useState(preloadedSchema);
  const [error, setError] = useState(null);
  const [values, setValues] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  // What the visitor sees after submitting (2.0 per-form confirmation).
  const [confirmationView, setConfirmationView] = useState(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [validationErrors, setValidationErrors] = useState({});
  const [isSubmitIntentional, setIsSubmitIntentional] = useState(false);
  const [liveMessage, setLiveMessage] = useState('');
  const liveRegionRef = useRef(null);
  // Root of the rendered form, used to scope "focus first invalid input" to
  // THIS form only — document.querySelector would jump across forms when two
  // forms share a page (A2/P1-5).
  const formRootRef = useRef(null);

  // Load schema (skip if preloaded)
  useEffect(() => {
    // Set render time for spam protection time trap
    if (!window.subtleformsRenderTime) {
      window.subtleformsRenderTime = Math.floor(Date.now() / 1000);
    }

    if (preloadedSchema) {
      // Keep the builder preview live: the schema prop changes on every edit
      // (appearance, fields, settings), and useState only read it once.
      setSchema(preloadedSchema);
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
        // API wraps responses in { data: ... }, but fall back to root-level schema for compatibility
        const schemaPayload = data?.data?.schema ?? data?.schema ?? null;
        if (schemaPayload) {
          setSchema(schemaPayload);
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

  // Prefill field values from the block's "Field Values" option (one
  // key=value pair per line). Runs once on mount. This hook MUST stay above
  // any conditional return — React requires hooks to run in the same order
  // on every render, and an early `return` here would skip it and trigger
  // React error #310 ("Rendered more hooks than during the previous render").
  useEffect(() => {
    if (!blockOptions?.fieldValues) {
      return;
    }
    const prefilled = {};
    blockOptions.fieldValues
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((line) => {
        const eq = line.indexOf('=');
        if (eq > 0) {
          const key = line.slice(0, eq).trim();
          const val = line.slice(eq + 1).trim();
          if (key) {
            prefilled[key] = val;
          }
        }
      });
    if (Object.keys(prefilled).length > 0) {
      setValues((prev) => ({ ...prefilled, ...prev }));
    }
    // Intentionally mount-only: prefill should not wipe user edits on re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Default values (2.0): applied once the schema is known, never over
  // anything the visitor or a prefill has already set.
  const defaultValues = useMemo(
    () => collectDefaultValues(schema?.fields || []),
    [schema]
  );
  useEffect(() => {
    if (Object.keys(defaultValues).length > 0) {
      setValues((prev) => ({ ...defaultValues, ...prev }));
    }
  }, [defaultValues]);

  // Calculation fields (2.0): recomputed whenever an input changes. The
  // server recomputes on submit, so this is display only.
  const calculationFields = useMemo(
    () =>
      allFields.filter(
        (f) => f.type === 'calculation' && (f.config ?? f).formula
      ),
    [allFields]
  );
  useEffect(() => {
    if (calculationFields.length === 0) return;
    setValues((prev) => {
      let next = prev;
      for (let pass = 0; pass < 2; pass++) {
        calculationFields.forEach((f) => {
          const c = f.config ?? f;
          const key = c.key || f.key;
          const result = evaluateFormula(c.formula, next, c.decimals ?? 2);
          if (next[key] !== result) {
            next = { ...next, [key]: result };
          }
        });
      }
      return next;
    });
  }, [values, calculationFields]);

  // True layout/container types — fields that group other fields but carry no
  // value of their own. Writes to their key are always ignored.
  //
  // Composite INPUT fields (name_group, address_group, address, checkbox_grid,
  // …) also have children, but they DO carry a value (an object) at their root
  // key — their renderers call onChange with an object that must be written.
  // Treating "has children" as "is a container" (the old logic) wrongly added
  // name_group's key here, so every keystroke into First/Last Name was silently
  // dropped (the value object was rejected as a "container write"). Only true
  // layout types belong in this set. See utils/schemaLeaves.js (Part A1).
  const containerPaths = useMemo(
    () => collectContainerKeys(schema?.fields || []),
    [schema]
  );

  const leafPaths = useMemo(() => {
    const paths = collectLeafInputPaths(schema?.fields || []);

    debug('[SubtleForms] Leaf Paths Calculation:', {
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
        debug('[SubtleForms] Value Update:', {
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
    const fieldsOnCurrentStep =
      hasSteps && currentStep
        ? (currentStep.children?.length > 0
            ? currentStep.children
            : currentStep.fields) || []
        : fieldsToRender;

    const errors = validateFields(fieldsOnCurrentStep, values, hiddenFields);

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [hasSteps, currentStep, fieldsToRender, hiddenFields, values]);

  // Handle step navigation
  // IMPORTANT: Step navigation NEVER triggers submission
  // This is intentional to prevent accidental form submission
  const handleNextStep = useCallback(() => {
    debug('[SubtleForms] Next Step:', {
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

  // Move focus to the first invalid input, scoped to this form's root element
  // so two forms on one page don't steal focus from each other (A2/P1-5).
  const focusFirstInvalid = useCallback(() => {
    requestAnimationFrame(() => {
      const root = formRootRef.current;
      if (!root) return;
      const firstErrorInput = root.querySelector(
        '[aria-invalid="true"]'
      );
      if (firstErrorInput && typeof firstErrorInput.focus === 'function') {
        firstErrorInput.focus();
        firstErrorInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      const errorCount = Object.keys(validationErrors).length;
      if (errorCount > 0) {
        setLiveMessage(
          sprintf(
            _n(
              'Please fix %d error before submitting.',
              'Please fix %d errors before submitting.',
              errorCount,
              'subtleforms'
            ),
            errorCount
          )
        );
      }
    });
  }, [validationErrors]);

  const handlePrevStep = useCallback(() => {
    debug('[SubtleForms] Prev Step:', {
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

      // In preview mode, run the same validation as the live form (so the
      // builder Preview shows the same errors a visitor would see) but never
      // submit. A banner under the form explains that submissions are not
      // saved. (Part A3.)
      if (preview) {
        const fieldsToValidate = hasSteps
          ? steps.flatMap((step) => step.children || step.fields || [])
          : schema?.fields || [];
        const errors = validateFields(fieldsToValidate, values, hiddenFields);
        setValidationErrors(errors);
        if (Object.keys(errors).length > 0) {
          focusFirstInvalid();
        }
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

        const allStepFields = steps.flatMap(
          (step) => step.children || step.fields || []
        );

        const errors = validateFields(allStepFields, values, hiddenFields);

        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
      };

      if (!validateAllSteps()) {
        // Focus first errored field for keyboard/screen reader users, scoped
        // to this form's root so two forms on one page never steal focus
        // from each other (A2/P1-5).
        focusFirstInvalid();
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
          // For composite group fields (name_group, address_group) the value is
          // stored as an object at the root key, not flattened with dots.
          const directValue = getIn(values, path);
          if (directValue !== undefined) {
            payload[path] = directValue;
          }
        }
      });

      // Debug logging for empty submissions
      debug('[SubtleForms] Submission Debug:', {
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
        // Add honeypot and time trap fields to payload. The honeypot input is
        // rendered in the DOM (Part B3); read its value so a bot that filled
        // it is rejected server-side.
        const honeypotInput = formRootRef.current?.querySelector(
          'input[name="website_url"]'
        );
        const submissionPayload = {
          ...payload,
          website_url: honeypotInput ? honeypotInput.value : '',
          form_rendered_at:
            window.subtleformsRenderTime || Math.floor(Date.now() / 1000),
        };

        // Include CAPTCHA response (v2 or v3)
        const recaptchaResponse = document.querySelector(
          'input[name="g-recaptcha-response"]'
        );
        if (recaptchaResponse && recaptchaResponse.value) {
          submissionPayload['g-recaptcha-response'] = recaptchaResponse.value;
          debug(
            '[SubtleForms] Including g-recaptcha-response in payload'
          );
        }

        const hcaptchaResponse = document.querySelector(
          'input[name="h-captcha-response"]'
        );
        if (hcaptchaResponse && hcaptchaResponse.value) {
          submissionPayload['h-captcha-response'] = hcaptchaResponse.value;
          debug('[SubtleForms] Including h-captcha-response in payload');
        }

        const turnstileResponse = document.querySelector(
          'input[name="cf-turnstile-response"]'
        );
        if (turnstileResponse && turnstileResponse.value) {
          submissionPayload['cf-turnstile-response'] = turnstileResponse.value;
          debug(
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

        if (response.ok && result?.data?.success) {
          const conf = schema?.metadata?.confirmation || {};
          const merge = (text, encode = false) =>
            String(text || '').replace(/\{([\w.-]+)\}/g, (match, key) => {
              const raw = getIn(values, key) ?? flatValues[key];
              if (raw === undefined || raw === null) return '';
              const str = Array.isArray(raw)
                ? raw.join(', ')
                : typeof raw === 'object'
                ? Object.values(raw).filter(Boolean).join(' ')
                : String(raw);
              return encode ? encodeURIComponent(str) : str;
            });
          const globalRedirect = window.subtleformsFrontend?.redirectUrl || '';
          const redirectTo =
            conf.type === 'redirect' && conf.redirectUrl
              ? merge(conf.redirectUrl, true)
              : !conf.type && globalRedirect
              ? globalRedirect
              : '';

          if (redirectTo && !preview) {
            if (customOnSubmit) {
              customOnSubmit(result.data);
            }
            window.location.assign(redirectTo);
            return;
          }

          setConfirmationView({
            title: conf.type === 'message' ? merge(conf.title) : '',
            message:
              conf.type === 'message' && conf.message
                ? merge(conf.message)
                : redirectTo
                ? sprintf(
                    /* translators: %s: URL */
                    __('Visitors will be sent to %s.', 'subtleforms'),
                    redirectTo
                  )
                : window.subtleformsFrontend?.successMessage ||
                  __('Thank you! Your submission has been received.', 'subtleforms'),
            allowAnother: !!conf.allowAnother,
          });
          setSubmitSuccess(true);
          setValues({ ...defaultValues });
          setCurrentStepIndex(0);

          if (customOnSubmit) {
            customOnSubmit(result.data);
          }
        } else {
          // If backend returned structured field errors, store them for per-field display.
          const errors = result?.data?.errors || result?.error?.meta?.errors || result?.errors;
          if (errors && typeof errors === 'object') {
            setValidationErrors(errors);
          }
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
    [
      formId,
      values,
      validateStep,
      leafPaths,
      preview,
      customOnSubmit,
      isSubmitIntentional,
      hasSteps,
      steps,
      hiddenFields,
      focusFirstInvalid,
      defaultValues,
      schema,
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
    const view = confirmationView || {
      title: '',
      message: __('Thank you! Your submission has been received.', 'subtleforms'),
    };
    return (
      <div className='subtleforms-success'>
        <div
          role='status'
          aria-live='polite'
          aria-atomic='true'
          className='subtleforms-success-message'>
          <span className='subtleforms-success-icon' aria-hidden='true'>
            <svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round'>
              <path d='M20 6 9 17l-5-5' />
            </svg>
          </span>
          {view.title && <h3>{view.title}</h3>}
          {String(view.message)
            .split(/\n{2,}/)
            .map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          {view.allowAnother && (
            <button
              type='button'
              className='subtleforms-button subtleforms-button-secondary subtleforms-success-again'
              onClick={() => {
                setSubmitSuccess(false);
                setConfirmationView(null);
              }}>
              {__('Submit another response', 'subtleforms')}
            </button>
          )}
        </div>
      </div>
    );
  }

  const isLastStep = !hasSteps || currentStepIndex === steps.length - 1;

  // Block-level options (from the Gutenberg block or shortcode) take
 // precedence over schema metadata for title/description visibility and for
  // the theme. This keeps the editor preview and the frontend in sync.
  const showTitle =
    blockOptions?.showTitle ?? schema?.metadata?._showTitle ?? true;
  const showDescription =
    blockOptions?.showDescription ?? schema?.metadata?._showDescription ?? true;

  const blockAppearance = (() => {
    const theme = blockOptions?.theme || schema?.metadata?._theme;
    if (!theme) {
      return null;
    }
    const preset = getPreset(theme) || getPreset('default');
    return {
      preset: preset.id,
      tokens: { ...preset.tokens },
      variants: { ...preset.variants },
    };
  })();

  const effectiveAppearance =
    blockAppearance || schema.metadata?.appearance;

  // Generate form type-aware CSS classes
  const formClassNames = [
    getFormClassNames(schema),
    formAppearanceClasses(effectiveAppearance),
  ]
    .filter(Boolean)
    .join(' ');

  // Appearance is applied as custom properties on the root, so every rule in the
  // public stylesheet picks it up by inheritance and no per-form CSS is emitted.
  const appearanceStyle = formAppearanceStyle(effectiveAppearance);

  return (
    <div ref={formRootRef} className={formClassNames} style={appearanceStyle}>
      {/* Screen reader live region for submission results and validation announcements */}
      <div
        ref={liveRegionRef}
        role='status'
        aria-live='assertive'
        aria-atomic='true'
        className='subtleforms-sr-only'
      >
        {liveMessage}
      </div>

      {preview && (
        <div className='subtleforms-preview-banner' role='status'>
          {__('Preview mode: submissions are not saved.', 'subtleforms')}
        </div>
      )}

      {showTitle && schema.metadata?.title && (
        <h2 className='subtleforms-form-title'>{schema.metadata.title}</h2>
      )}

      {showDescription && schema.metadata?.description && (
        <p className='subtleforms-form-description'>
          {schema.metadata.description}
        </p>
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

      <form
        role='form'
        aria-label={schema.metadata?.title || __('Form', 'subtleforms')}
        noValidate
        tabIndex={blockOptions?.tabIndex ? blockOptions.tabIndex : undefined}
        onSubmit={handleSubmit}>
        {/* Honeypot: a visually hidden field real users never see but bots
            fill in. The server rejects any submission that has a value here
            (Part B3). It is excluded from tab order and screen readers. */}
        <div className='subtleforms-honeypot' aria-hidden='true'>
          <label htmlFor={`subtleforms-honeypot-${formId}`}>
            {__('Website', 'subtleforms')}
          </label>
          <input
            id={`subtleforms-honeypot-${formId}`}
            type='text'
            name='website_url'
            tabIndex={-1}
            autoComplete='off'
            aria-hidden='true'
          />
        </div>
        {submitError && (
          <div className='subtleforms-error' role='alert'>
            {submitError}
          </div>
        )}

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

          <div className='subtleforms-fields'>
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
                ? __('Submitting…', 'subtleforms')
                : schema?.metadata?.submitText?.trim() || __('Submit', 'subtleforms')}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
