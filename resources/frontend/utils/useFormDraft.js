/**
 * Keeps a visitor's answers and place in a multi-step or conversational form
 * in sessionStorage, so a reload or back and forward does not lose them
 * (issue 139). The draft is dropped when the form is sent.
 */
import { useCallback, useEffect, useLayoutEffect, useRef } from '@wordpress/element';
import { fieldTypesOf } from '../../shared/confirmationTags';

const MAX_AGE = 24 * 60 * 60 * 1000;
const SAVE_DELAY = 400;

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

function read(key) {
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

function write(key, draft) {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(draft));
  } catch (e) {
    // Private mode or blocked storage: the form works, it just forgets.
  }
}

function remove(key) {
  try {
    window.sessionStorage.removeItem(key);
  } catch (e) {
    // Ignore, see write().
  }
}

/** Keep only answers to fields that are in the schema and are safe to store. */
function allowed(values, types) {
  const out = {};
  Object.keys(values || {}).forEach((k) => {
    const type = types[k];
    if (type && !SKIP_TYPE.test(type)) out[k] = values[k];
  });
  return out;
}

/**
 * @param {Object}   o
 * @param {boolean}  o.enabled  False for single-page forms, previews, and after a send.
 * @param {*}        o.formId
 * @param {number}   o.instance Copy number of this form on the page.
 * @param {Object}   o.schema
 * @param {Object}   o.values   Current answers.
 * @param {number}   o.step     Step or question index.
 * @param {string}   [o.view]   'questions' or 'review' (conversational).
 * @param {number}   o.stepCount
 * @param {Function} o.onRestore Called once with { step, view, values }.
 * @return {{clear: Function}}
 */
export default function useFormDraft({ enabled, formId, instance, schema, values, step, view, stepCount, onRestore }) {
  const key = draftKey(formId, instance);
  const restoredKey = useRef(null);
  const restore = useRef(onRestore);
  restore.current = onRestore;

  useLayoutEffect(() => {
    if (!enabled || !schema || restoredKey.current === key) return;
    restoredKey.current = key;
    const draft = read(key);
    if (!draft) return;
    const last = Math.max(0, Number(stepCount) - 1);
    const n = Math.floor(Number(draft.step));
    restore.current({
      step: Math.min(Math.max(Number.isFinite(n) ? n : 0, 0), last),
      view: draft.view === 'review' ? 'review' : 'questions',
      values: allowed(draft.values, fieldTypesOf(schema)),
    });
  }, [enabled, key, schema, stepCount]);

  useEffect(() => {
    if (!enabled || !schema || restoredKey.current !== key) return undefined;
    const timer = setTimeout(() => {
      const draft = { v: 1, savedAt: Date.now(), step, values: allowed(values, fieldTypesOf(schema)) };
      if (view) draft.view = view;
      write(key, draft);
    }, SAVE_DELAY);
    return () => clearTimeout(timer);
  }, [enabled, key, schema, values, step, view]);

  const clear = useCallback(() => remove(key), [key]);
  return { clear };
}
