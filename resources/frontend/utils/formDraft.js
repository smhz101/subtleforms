/**
 * Storage side of the form draft (issue 139). Loaded on demand by
 * useFormDraft so forms without steps never download it.
 */
import { useEffect, useLayoutEffect, useRef } from '@wordpress/element';
import { fieldTypesOf } from '../../shared/confirmationTags';

const MAX_AGE = 24 * 60 * 60 * 1000;

/** Types whose values must never be written to storage. */
const SKIP_TYPE = /^(password|file|file_upload|image_upload|signature|payment|captcha|recaptcha|hcaptcha|turnstile)/;

export function draftKey(formId, instance) {
  let path = '';
  try {
    path = window.location.pathname;
  } catch (e) {
    path = '';
  }
  return `subtleforms_draft_${formId}_${instance}_${path}`;
}

export function read(key) {
  try {
    const raw = window.sessionStorage.getItem(key);
    const draft = raw ? JSON.parse(raw) : null;
    if (!draft || draft.v !== 1 || !draft.values || typeof draft.values !== 'object') return null;
    if (!(Date.now() - Number(draft.savedAt) < MAX_AGE)) return null;
    return draft;
  } catch (e) {
    return null;
  }
}

export function write(key, draft) {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(draft));
  } catch (e) {
    // Private mode or blocked storage: the form works, it just forgets.
  }
}

export function remove(key) {
  try {
    window.sessionStorage.removeItem(key);
  } catch (e) {
    // Ignore, see write().
  }
}

/** Keep only answers to fields that are in the schema and are safe to store. */
export function allowed(values, schema) {
  const types = fieldTypesOf(schema);
  const out = {};
  Object.keys(values || {}).forEach((k) => {
    const type = types[k];
    if (type && !SKIP_TYPE.test(type)) out[k] = values[k];
  });
  return out;
}

const SAVE_DELAY = 400;

/**
 * Renders nothing. Restores the draft once on mount, then saves 400 ms after
 * any change. Mounted by useFormDraft only while a draft is wanted.
 */
export default function DraftKeeper({ formId, instance, schema, values, step, view, stepCount, setValues, setStep, setView }) {
  const key = draftKey(formId, instance);
  const restored = useRef(null);

  useLayoutEffect(() => {
    if (!schema || restored.current === key) return;
    restored.current = key;
    const draft = read(key);
    if (!draft) return;
    const last = Math.max(0, Number(stepCount) - 1);
    const n = Math.floor(Number(draft.step));
    setValues((prev) => ({ ...prev, ...allowed(draft.values, schema) }));
    setStep(Math.min(Math.max(Number.isFinite(n) ? n : 0, 0), last));
    if (setView) setView(draft.view === 'review' ? 'review' : 'questions');
  }, [key, schema, stepCount]);

  useEffect(() => {
    if (!schema || restored.current !== key) return undefined;
    const timer = setTimeout(() => {
      const draft = { v: 1, savedAt: Date.now(), step, values: allowed(values, schema) };
      if (view) draft.view = view;
      write(key, draft);
    }, SAVE_DELAY);
    return () => clearTimeout(timer);
  }, [key, schema, values, step, view]);

  return null;
}
