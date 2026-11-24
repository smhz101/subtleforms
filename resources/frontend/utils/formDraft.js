/**
 * Storage side of the form draft (issue 139). Loaded on demand by
 * useFormDraft so forms without steps never download it.
 */
import { useEffect, useLayoutEffect, useRef } from '@wordpress/element';
import { columnFields } from './columnFields';

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

/** Key => field node for every field the renderer shows. A repeater's own children are not listed. */
function fieldsByKey(list, out = {}) {
  (Array.isArray(list) ? list : []).forEach((f) => {
    if (!f || typeof f !== 'object') return;
    const k = f.config?.key || f.key;
    if (k && f.type) out[k] = f;
    if (f.type === 'repeat_container') return;
    fieldsByKey(f.children, out);
    fieldsByKey(f.fields, out);
    (Array.isArray(f.columns) ? f.columns : []).forEach((c) => fieldsByKey(columnFields(c), out));
  });
  return out;
}

/** The safe part of one answer, or undefined to drop it. Fails closed. */
function safeValue(value, field) {
  if (!field || SKIP_TYPE.test(field.type)) return undefined;
  if (field.type !== 'repeat_container') return value;
  if (!Array.isArray(value)) return undefined;
  const children = fieldsByKey(field.children || field.fields);
  return value.map((row) => {
    const kept = {};
    if (row && typeof row === 'object') {
      Object.keys(row).forEach((k) => {
        const v = safeValue(row[k], children[k]);
        if (v !== undefined) kept[k] = v;
      });
    }
    return kept;
  });
}

/** Keep only answers to fields that are in the schema and are safe to store. */
export function allowed(values, schema) {
  const fields = fieldsByKey(schema?.fields);
  const out = {};
  Object.keys(values || {}).forEach((k) => {
    const v = safeValue(values[k], fields[k]);
    if (v !== undefined) out[k] = v;
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
