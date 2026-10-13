import { useState, useEffect, useCallback, useMemo, useRef } from '@wordpress/element';
import { __, sprintf, _n } from '@wordpress/i18n';
import FieldRenderer from './FieldRenderer';
import StepNavigation from './StepNavigation';
import ConversationalFormRenderer from './ConversationalFormRenderer';
import { getIn, setIn, deleteIn, flattenToPathMap } from '../utils/valuePaths';
import { collectLeafInputPaths, collectContainerKeys } from '../utils/schemaLeaves';
import { collectDefaultValues } from '../utils/defaults';
import { evaluateFormula } from '../utils/formula';
import { computeLogicState, pickConfirmation } from '../../shared/conditions';
import {
  validateFields,
} from '../utils/fieldValidation';
import { warnOnce } from '../utils/warnOnce';
import { serverFieldErrors, fixFieldsSummary } from '../utils/serverErrors';
import { getFormClassNames } from '../utils/formStyles';
import { structuralType } from '../../shared/formType';
import { formFieldDefaults } from '../../shared/fieldDisplay';
import { debug } from '../../shared/debug';
import { fieldConfig } from '../../shared/fieldConfig';
import { computeQuote, isPricedForm, formatMoney, isPricedType } from '../../shared/pricing';
import { PaymentContext } from './fields/Payments';
import { FormContext } from './fields/FileUpload';
import {
  formAppearanceStyle,
  formAppearanceClasses,
  getPreset,
} from '../../shared/appearance';

const restUrl =
  window.subtleformsFrontend?.restUrl ||
  window.subtleformsAdmin?.restUrl ||
  '/wp-json/subtleforms/v1';
const nonce =
  window.subtleformsFrontend?.nonce ||
  window.subtleformsAdmin?.restNonce ||
  '';

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
  // "Please fix the N highlighted fields." shown above the form while any
  // field (client or server checked) has an error (bug 2).
  const [errorSummary, setErrorSummary] = useState('');
  const [isSubmitIntentional, setIsSubmitIntentional] = useState(false);
  const [liveMessage, setLiveMessage] = useState('');
  const liveRegionRef = useRef(null);
  // Root of the rendered form, used to scope "focus first invalid input" to
  // THIS form only — document.querySelector would jump across forms when two
  // forms share a page (A2/P1-5).
  const formRootRef = useRef(null);
  // Random per mount: a name like "website" invites autofill (bug 16). The
  // value is still sent to the server as website_url.
  const honeypotSuffix = useMemo(
    () => Math.random().toString(36).slice(2, 10),
    []
  );
  const honeypotName = `sf_hp_${honeypotSuffix}`;
  const honeypotId = `subtleforms-hp-${formId}-${honeypotSuffix}`;

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
  // The structure decides between Standard and Multi-step (2.3.2).
  const formType = useMemo(() => structuralType(schema || {}), [schema]);

  // Form-level defaults for label visibility, help text placement and
  // messages (2.3.2).
  const fieldDefaults = useMemo(() => formFieldDefaults(schema?.metadata), [schema?.metadata]);

  const isMultistep = formType === 'multi-step';
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
        (f) => f.type === 'calculation' && fieldConfig(f).formula
      ),
    [allFields]
  );
  useEffect(() => {
    if (calculationFields.length === 0) return;
    setValues((prev) => {
      let next = prev;
      for (let pass = 0; pass < 2; pass++) {
        calculationFields.forEach((f) => {
          const c = fieldConfig(f);
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

  // Conditional logic (2.1): one evaluator shared with the server
  // (shared/conditions.js mirrors src/Engine/ConditionalLogic.php). Fields in
  // a skipped step count as hidden, and hidden answers never count.
  const logicState = useMemo(
    () => computeLogicState(schema || {}, values),
    [schema, values]
  );
  const hiddenFields = useMemo(
    () => new Set(logicState.hidden_fields),
    [logicState]
  );
  const hiddenSteps = useMemo(
    () => new Set(logicState.hidden_steps),
    [logicState]
  );
  const stepKeyOf = (step) =>
    step?.key || step?.config?.key || step?.id || '';
  const isStepVisible = useCallback(
    (index) => {
      const step = steps[index];
      return !!step && !hiddenSteps.has(stepKeyOf(step));
    },
    [steps, hiddenSteps]
  );
  const nextVisibleStep = useCallback(
    (from) => {
      for (let i = from + 1; i < steps.length; i++) {
        if (isStepVisible(i)) return i;
      }
      return -1;
    },
    [steps, isStepVisible]
  );
  const prevVisibleStep = useCallback(
    (from) => {
      for (let i = from - 1; i >= 0; i--) {
        if (isStepVisible(i)) return i;
      }
      return -1;
    },
    [isStepVisible]
  );

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
        if (Object.keys(next).length === 0) {
          setErrorSummary('');
        }
        return next;
      });
    },
    [containerPaths]
  );

  // Move focus to the first invalid input, scoped to this form's root element
  // so two forms on one page don't steal focus from each other (A2/P1-5).
  const focusFirstInvalid = useCallback((errorCount = 0) => {
    if (errorCount > 0) {
      const summary = fixFieldsSummary(errorCount);
      setErrorSummary(summary);
      setLiveMessage(summary);
    }
    // Two frames: the error state has to render before aria-invalid exists.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const root = formRootRef.current;
        if (!root) return;
        const firstErrorInput = root.querySelector(
          'input[aria-invalid="true"], select[aria-invalid="true"], textarea[aria-invalid="true"], [role="textbox"][aria-invalid="true"], [aria-invalid="true"]'
        );
        let target = firstErrorInput;
        // A radio or checkbox group marks the group; focus its first input.
        if (target && !/^(INPUT|SELECT|TEXTAREA)$/.test(target.tagName) && target.getAttribute('role') !== 'textbox') {
          target = target.querySelector('input, select, textarea, [tabindex]') || target;
        }
        if (target && typeof target.focus === 'function') {
          target.focus();
          if (typeof target.scrollIntoView === 'function') {
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      })
    );
  }, []);

  // Validate current step
  const validateStep = useCallback(() => {
    const fieldsOnCurrentStep =
      hasSteps && currentStep
        ? (currentStep.children?.length > 0
            ? currentStep.children
            : currentStep.fields) || []
        : fieldsToRender;

    const errors = validateFields(fieldsOnCurrentStep, values, hiddenFields, fieldDefaults);

    setValidationErrors(errors);
    const count = Object.keys(errors).length;
    if (count > 0) {
      focusFirstInvalid(count);
    } else {
      setErrorSummary('');
    }
    return count === 0;
  }, [hasSteps, currentStep, fieldsToRender, hiddenFields, values, focusFirstInvalid, fieldDefaults]);

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

    // Only advance to next step, never submit. Steps whose conditions fail
    // are skipped (2.1).
    const next = nextVisibleStep(currentStepIndex);
    if (next !== -1) {
      setCurrentStepIndex(next);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // DEFENSIVE: Explicitly do NOT call handleSubmit here
    // Multi-step forms should only submit when user clicks Submit button
  }, [currentStepIndex, steps, validateStep, values, nextVisibleStep]);


  const handlePrevStep = useCallback(() => {
    debug('[SubtleForms] Prev Step:', {
      currentStepIndex: currentStepIndex,
      currentValues: values,
      valuesKeys: Object.keys(values),
    });

    const prev = prevVisibleStep(currentStepIndex);
    if (prev !== -1) {
      setCurrentStepIndex(prev);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentStepIndex, values, prevVisibleStep]);

  // ── Payments (2.1) ──────────────────────────────────────────────────────
  // One live order for the whole form. Priced fields feed it, the summary and
  // coupon box read it, and the card field hands its total to the gateway.
  const isPriced = useMemo(() => isPricedForm(allFields), [allFields]);
  const currency =
    schema?.metadata?.payment?.currency || window.subtleformsFrontend?.currency || 'USD';
  const [coupon, setCoupon] = useState(null);
  const [couponBusy, setCouponBusy] = useState(false);
  const [couponError, setCouponError] = useState('');
  const cardRef = useRef(null);
  const quote = useMemo(
    () =>
      isPriced
        ? computeQuote(allFields, values, { coupon, hidden: hiddenFields, currency })
        : null,
    [isPriced, allFields, values, coupon, hiddenFields, currency]
  );
  // Another checkout (e.g. WooCommerce, set by an add-on) takes the payment
  // after the form is sent, so the Card field is not used.
  const externalCheckout =
    !!schema?.metadata?.payment?.processor && schema.metadata.payment.processor !== 'subtleforms';
  const hasCardField = useMemo(
    () => !externalCheckout && allFields.some((f) => f.type === 'payment_card'),
    [allFields, externalCheckout]
  );

  const applyCoupon = useCallback(
    async (code) => {
      setCouponBusy(true);
      setCouponError('');
      try {
        const res = await fetch(`${restUrl.replace(/\/$/, '')}/payments/coupon`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': nonce },
          body: JSON.stringify({ form_id: formId, code, data: flattenToPathMap(values) }),
        });
        const json = await res.json().catch(() => ({}));
        const found = json?.data?.coupon;
        if (res.ok && found) {
          setCoupon(found);
        } else {
          setCouponError(
            json?.error?.message || json?.message || __('This coupon code is not valid.', 'subtleforms')
          );
        }
      } catch (e) {
        setCouponError(__('The code could not be checked. Please try again.', 'subtleforms'));
      } finally {
        setCouponBusy(false);
      }
    },
    [formId, values]
  );

  const paymentContext = useMemo(
    () =>
      isPriced
        ? {
            formId,
            preview,
            currency,
            quote,
            coupon,
            couponBusy,
            couponError,
            applyCoupon,
            removeCoupon: () => {
              setCoupon(null);
              setCouponError('');
            },
            hasCouponField: allFields.some((f) => f.type === 'payment_coupon'),
            external: externalCheckout,
            registerCard: (handle) => {
              cardRef.current = handle;
            },
          }
        : null,
    [isPriced, formId, preview, currency, quote, coupon, couponBusy, couponError, applyCoupon, allFields, externalCheckout]
  );

  // Form details for fields that talk to the server (uploads).
  const formContext = useMemo(
    () => ({ formId, preview, fieldDefaults }),
    [formId, preview, fieldDefaults]
  );

  // On a multi-step form, show the first step that has a field in error.
  const goToStepWithError = useCallback(
    (errors) => {
      if (!hasSteps) return;
      // Errors inside a Repeater group (`items.0.qty`) belong to `items`.
      const keys = new Set(
        Object.keys(errors || {}).flatMap((k) => [k, k.split('.')[0]])
      );
      const stepHasError = (nodes) =>
        (nodes || []).some((n) => {
          const k = n?.config?.key || n?.key;
          if (k && keys.has(k)) return true;
          return (
            stepHasError(n?.children) ||
            stepHasError(n?.fields) ||
            (Array.isArray(n?.columns) && n.columns.some((c) => Array.isArray(c) && stepHasError(c)))
          );
        });
      const index = steps.findIndex((step) => stepHasError(step.children || step.fields));
      if (index !== -1 && index !== currentStepIndex) {
        setCurrentStepIndex(index);
      }
    },
    [hasSteps, steps, currentStepIndex]
  );

  // Handle form submission
  // SUBMISSION GUARD: Only submit when explicitly requested via Submit button
  const handleSubmitOnce = useCallback(
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

      // For submission, validate all required fields across all steps, not just current step
      const allFieldsToCheck = hasSteps
        ? steps.flatMap((step) => step.children || step.fields || [])
        : fieldsToRender;
      const clientErrors = validateFields(allFieldsToCheck, values, hiddenFields, fieldDefaults);
      setValidationErrors(clientErrors);

      if (Object.keys(clientErrors).length > 0) {
        // Focus first errored field for keyboard/screen reader users, scoped
        // to this form's root so two forms on one page never steal focus
        // from each other (A2/P1-5).
        goToStepWithError(clientErrors);
        focusFirstInvalid(Object.keys(clientErrors).length);
        return;
      }

      // Preview uses this same submit. A form that has never been saved has
      // no id, so there is nothing to attach the entry to.
      if (preview && !Number(formId)) {
        setSubmitError(
          __('Save the form first, then submit the preview.', 'subtleforms')
        );
        return;
      }

      setSubmitting(true);
      setSubmitError(null);
      setErrorSummary('');

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

      // Answers to hidden fields (and skipped steps) are not sent; the server
      // drops them too.
      let visiblePayload = payload;
      hiddenFields.forEach((k) => {
        if (Object.prototype.hasOwnProperty.call(visiblePayload, k)) {
          delete visiblePayload[k];
        } else if (k.indexOf('.') !== -1) {
          // A hidden field inside a Repeater group (`items.1.qty`).
          visiblePayload = deleteIn(visiblePayload, k);
        }
      });
      if (visiblePayload !== payload) {
        Object.keys(payload).forEach((k) => delete payload[k]);
        Object.assign(payload, visiblePayload);
      }

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
          'input[data-subtleforms-honeypot]'
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

        if (isPriced) {
          // Fields hidden by conditional logic are not part of the order.
          allFields.forEach((f) => {
            const k = (f.config ?? f).key || f.key;
            if (k && hiddenFields.has(k) && isPricedType(f.type)) {
              delete submissionPayload[k];
            }
          });
          if (coupon) {
            submissionPayload._coupon = coupon.code;
          }
          if (quote && quote.total > 0 && hasCardField) {
            if (!cardRef.current?.confirm) {
              setSubmitError(__('Online payment is not available right now.', 'subtleforms'));
              setSubmitting(false);
              return;
            }
            try {
              const paid = await cardRef.current.confirm({
                formId,
                data: submissionPayload,
                restUrl: restUrl.replace(/\/$/, ''),
                nonce,
              });
              submissionPayload._payment = paid?.reference || '';
            } catch (payErr) {
              if (payErr?.inline) {
                // A decline or incomplete card: the Card field shows the
                // reason next to the card, and every other answer stays.
                setSubmitError(null);
                cardRef.current?.focus?.();
              } else {
                setSubmitError(payErr?.message || __('Your payment could not be completed.', 'subtleforms'));
              }
              setSubmitting(false);
              return;
            }
          }
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

        if (response.ok && result?.data?.success && result.data.redirect && !preview) {
          // An add-on (e.g. WooCommerce checkout) takes the visitor onward.
          if (customOnSubmit) customOnSubmit(result.data);
          window.location.assign(result.data.redirect);
          return;
        }

        if (response.ok && result?.data?.success) {
          // The server picks the confirmation (first conditional one that
          // matches, else the default); the same evaluator runs here as a
          // fallback for older servers.
          const conf =
            result.data.confirmation ||
            pickConfirmation(schema?.metadata, payload) ||
            {};
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
          setCoupon(null);
          setValues({ ...defaultValues });
          setCurrentStepIndex(0);

          if (customOnSubmit) {
            customOnSubmit(result.data);
          }
        } else {
          // Field errors from the server (422, meta.fields) go on the fields
          // themselves, exactly like client-side errors (bug 2).
          const fieldErrors = serverFieldErrors(result);
          const count = Object.keys(fieldErrors).length;
          if (count > 0) {
            setValidationErrors(fieldErrors);
            setSubmitError(null);
            goToStepWithError(fieldErrors);
            focusFirstInvalid(count);
          } else {
            setSubmitError(
              result?.error?.message || result?.data?.message || __('Submission failed.', 'subtleforms')
            );
          }
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
      goToStepWithError,
      fieldsToRender,
      defaultValues,
      schema,
      isPriced,
      allFields,
      coupon,
      quote,
      hasCardField,
    ]
  );

  // One entry per submit: a double click, or Enter plus a click, while the
  // first request is still running does not send a second one (2.3.3).
  const submitLockRef = useRef(false);
  const handleSubmit = useCallback(
    async (e) => {
      if (submitLockRef.current) {
        e?.preventDefault?.();
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

  const isLastStep = !hasSteps || nextVisibleStep(currentStepIndex) === -1;
  const visibleSteps = hasSteps
    ? steps.filter((_, i) => isStepVisible(i))
    : [];

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
          steps={visibleSteps}
          currentStepIndex={Math.max(0, visibleSteps.indexOf(currentStep))}
          onStepClick={(index) => {
            // Allow clicking on completed steps. Indexes are of the visible
            // steps; map back to the full list.
            const target = steps.indexOf(visibleSteps[index]);
            if (target !== -1 && target <= currentStepIndex) {
              setCurrentStepIndex(target);
            }
          }}
        />
      )}

      <FormContext.Provider value={formContext}>
      <PaymentContext.Provider value={paymentContext}>
      <form
        role='form'
        aria-label={schema.metadata?.title || __('Form', 'subtleforms')}
        noValidate
        tabIndex={blockOptions?.tabIndex ? blockOptions.tabIndex : undefined}
        onSubmit={handleSubmit}>
        {/* Honeypot: a visually hidden field real users never see but bots
            fill in. The server rejects any submission that has a value here
            (Part B3). It is excluded from tab order and screen readers, its
            name is random per page view so autofill and password managers do
            not recognise it, and its label is not part of the page text that
            readers and scrapers pick up (bug 16). */}
        <div className='subtleforms-honeypot' aria-hidden='true'>
          <label htmlFor={honeypotId}>
            <span className='subtleforms-sr-only'>
              {__('Leave this field empty', 'subtleforms')}
            </span>
          </label>
          <input
            id={honeypotId}
            type='text'
            name={honeypotName}
            data-subtleforms-honeypot='1'
            tabIndex={-1}
            autoComplete='off'
            data-lpignore='true'
            data-1p-ignore='true'
            data-form-type='other'
            aria-hidden='true'
          />
        </div>
        {(submitError || errorSummary) && (
          <div className='subtleforms-error' role='alert'>
            {submitError || errorSummary}
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
          {hasSteps && prevVisibleStep(currentStepIndex) !== -1 && (
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
                : schema?.metadata?.submitText?.trim() ||
                  (hasCardField && quote?.total > 0
                    ? sprintf(
                        /* translators: %s: order total */
                        __('Pay %s', 'subtleforms'),
                        formatMoney(quote.total, currency)
                      )
                    : externalCheckout && quote?.items?.length
                    ? __('Continue to checkout', 'subtleforms')
                    : __('Submit', 'subtleforms'))}
            </button>
          )}
        </div>
      </form>
      </PaymentContext.Provider>
      </FormContext.Provider>
    </div>
  );
}
