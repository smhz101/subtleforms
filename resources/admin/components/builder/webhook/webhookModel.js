/**
 * What a webhook sends, as data (2.5.0).
 *
 * Pure helpers for the notification builder: the headers as rows, the
 * ticked payload as a list of keys, a live example of the JSON body, and the
 * conversion between the checkbox view and the JSON view. The server builds
 * the real body in Webhooks::selectedBody(); the key names and the order of
 * the body here follow it.
 */
import { __ } from '@wordpress/i18n';

// ─── Headers ────────────────────────────────────────────────────────────────

/** Header names the server refuses (Webhooks::BLOCKED_HEADERS). */
export const BLOCKED_HEADERS = [
  'host',
  'content-length',
  'transfer-encoding',
  'connection',
  'keep-alive',
  'upgrade',
  'te',
  'trailer',
  'proxy-authorization',
  'proxy-connection',
  'x-subtleforms-signature',
];

const TOKEN = /^[A-Za-z0-9!#$%&'*+.^_`|~-]+$/;

let rowCounter = 0;
const rowId = () => `h${(rowCounter += 1)}`;

/**
 * Why a header cannot be sent, or '' when it can. The same rules as the
 * server (Webhooks::headerProblem).
 *
 * @param {string} name  Header name.
 * @param {string} value Header value.
 * @return {''|'invalid_name'|'blocked'|'invalid_value'} Reason code.
 */
export function headerProblem(name, value) {
  const n = String(name ?? '').trim();
  if (!n || !TOKEN.test(n)) return 'invalid_name';
  if (BLOCKED_HEADERS.includes(n.toLowerCase())) return 'blocked';
  if (/[\r\n]/.test(String(value ?? ''))) return 'invalid_value';
  return '';
}

/**
 * Plain words for a reason code.
 *
 * @param {string} code Reason from headerProblem().
 * @param {string} name Header name.
 * @return {string} Message.
 */
export function headerProblemText(code, name = '') {
  switch (code) {
    case 'invalid_name':
      return String(name).trim()
        ? __('A header name can use letters, numbers and these characters: - _ . ! # $ % & \' * + ^ ` | ~', 'subtleforms')
        : __('Enter a header name.', 'subtleforms');
    case 'blocked':
      return __('SubtleForms sets this header itself, so it cannot be changed here.', 'subtleforms');
    case 'invalid_value':
      return __('A header value must be on one line.', 'subtleforms');
    case 'duplicate':
      return __('This header is already listed. A header can only be set once.', 'subtleforms');
    default:
      return '';
  }
}

/**
 * The saved headers object as rows for the editor.
 *
 * @param {Object} headers Name to value.
 * @return {Array<{id: string, name: string, value: string}>} Rows.
 */
export function headersToRows(headers) {
  if (!headers || typeof headers !== 'object' || Array.isArray(headers)) return [];
  return Object.entries(headers).map(([name, value]) => ({
    id: rowId(),
    name,
    value: value === null || value === undefined ? '' : String(value),
  }));
}

/**
 * The problem of each row: its own rule, or a repeated name.
 *
 * @param {Array} rows Editor rows.
 * @return {string[]} One reason code per row, '' when the row is fine.
 */
export function rowProblems(rows) {
  const seen = new Set();
  return rows.map((row) => {
    // A row the user has not started is not an error yet.
    if (!String(row.name).trim() && !String(row.value).trim()) return '';
    const own = headerProblem(row.name, row.value);
    if (own) return own;
    const key = String(row.name).trim().toLowerCase();
    if (seen.has(key)) return 'duplicate';
    seen.add(key);
    return '';
  });
}

/**
 * The headers object to save: only rows that are complete and valid.
 *
 * @param {Array} rows Editor rows.
 * @return {Object} Name to value.
 */
export function rowsToHeaders(rows) {
  const problems = rowProblems(rows);
  const out = {};
  rows.forEach((row, i) => {
    if (!problems[i] && String(row.name).trim()) out[String(row.name).trim()] = String(row.value);
  });
  return out;
}

/**
 * The headers as the text of the JSON view.
 *
 * @param {Array} rows Editor rows.
 * @return {string} Pretty JSON.
 */
export function rowsToJson(rows) {
  return JSON.stringify(rowsToHeaders(rows), null, 2);
}

/**
 * Read the JSON view. Nothing is thrown away: an error says what is wrong
 * and the caller keeps the text.
 *
 * @param {string} text JSON typed by the user.
 * @return {{ok: true, rows: Array}|{ok: false, error: string}} Result.
 */
export function parseHeadersJson(text) {
  const raw = String(text ?? '').trim();
  if (!raw) return { ok: true, rows: [] };
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return { ok: false, error: __('This is not valid JSON yet. Check the quotes, commas and brackets.', 'subtleforms') };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, error: __('Headers must be a JSON object, for example {"X-Source": "subtleforms"}.', 'subtleforms') };
  }
  for (const [name, value] of Object.entries(parsed)) {
    if (value !== null && typeof value === 'object') {
      return { ok: false, error: __('The value of each header must be text.', 'subtleforms') };
    }
    if (!name) return { ok: false, error: __('A header needs a name.', 'subtleforms') };
  }
  return { ok: true, rows: headersToRows(parsed) };
}

// ─── Form fields ────────────────────────────────────────────────────────────

/** Types that hold no answer (FieldMapper::LAYOUT_TYPES). */
const LAYOUT_TYPES = [
  'html', 'heading', 'divider', 'section', 'section_break', 'step', 'form_step', 'page_break',
  'spacer', 'paragraph', 'columns', 'group', 'row', 'disclaimer', 'recaptcha', 'hcaptcha',
  'turnstile', 'action_hook', 'save_resume', 'payment_summary',
];

/** Types a webhook never sends (Webhooks::SENSITIVE_TYPES). */
export const SENSITIVE_TYPES = ['password', 'signature', 'payment_card'];

const REPEATER = 'repeat_container';

/** Types whose answer is one piece of text or a number. */
const SCALAR_TYPES = [
  'text', 'email', 'textarea', 'number', 'phone', 'tel', 'url', 'website', 'date', 'time',
  'datetime', 'radio', 'dropdown', 'select', 'rating', 'scale', 'net_promoter_score',
  'range_slider', 'color_picker', 'hidden', 'rich_text', 'consent', 'toggle',
];

const flat = (node) => (node && typeof node.config === 'object' && node.config ? { ...node.config, ...node } : node);

/**
 * The fields a webhook can send, in form order: the answer-bearing fields of
 * the schema as the server lists them. A repeater is one field; the fields
 * inside it are not listed. Password, signature and card fields are left out
 * because they are never sent.
 *
 * @param {Array} nodes Schema fields.
 * @param {Array} out   Collected fields.
 * @return {Array<{key: string, label: string, type: string, children?: Array}>} Fields.
 */
export function collectPayloadFields(nodes, out = []) {
  if (!Array.isArray(nodes)) return out;
  nodes.forEach((raw) => {
    if (!raw || typeof raw !== 'object') return;
    const node = flat(raw);
    const type = String(raw.type || node.type || '');
    const key = String(node.key || node.name || '');
    if (type === REPEATER) {
      if (key && !out.some((f) => f.key === key)) {
        const children = collectPayloadFields(node.children || node.fields || []);
        out.push({ key, label: node.adminLabel || node.label || key, type, children });
      }
      return;
    }
    const isLayout = LAYOUT_TYPES.includes(type) || type.endsWith('_container');
    if (key && type && !isLayout && !SENSITIVE_TYPES.includes(type) && !out.some((f) => f.key === key)) {
      out.push({ key, label: node.adminLabel || node.label || key, type });
    }
    collectPayloadFields(node.fields, out);
    collectPayloadFields(node.children, out);
    if (Array.isArray(node.columns)) {
      node.columns.forEach((column) => {
        if (Array.isArray(column)) collectPayloadFields(column, out);
        else if (column && typeof column === 'object') collectPayloadFields(column.fields || column.children, out);
      });
    }
  });
  return out;
}

/**
 * Whether the form takes a payment.
 *
 * @param {Array} nodes Schema fields.
 * @return {boolean} True when a payment field exists.
 */
export function formHasPayment(nodes) {
  let found = false;
  const walk = (list) => {
    if (!Array.isArray(list) || found) return;
    list.forEach((raw) => {
      if (!raw || typeof raw !== 'object' || found) return;
      if (String(raw.type || '').startsWith('payment_')) found = true;
      walk(raw.fields);
      walk(raw.children);
      if (Array.isArray(raw.columns)) raw.columns.forEach((c) => walk(Array.isArray(c) ? c : c?.fields || c?.children));
    });
  };
  walk(nodes);
  return found;
}

// ─── What can be ticked ─────────────────────────────────────────────────────

export const FIELD_PREFIX = 'field:';
export const LABELS_OPTION = 'answers_with_labels';

export const FORM_KEYS = ['form_id', 'form_title'];
export const SUBMISSION_KEYS = ['submission_id', 'created_at', 'status', 'page_url', 'ip_address', 'user_agent', 'user_id'];
export const PAYMENT_KEYS = ['payment_amount', 'payment_currency', 'payment_status'];

/** The groups of the checkbox picker, without the answers. */
export function keyGroups() {
  return [
    {
      id: 'form',
      title: __('Form', 'subtleforms'),
      items: [
        { key: 'form_id', label: __('Form ID', 'subtleforms') },
        { key: 'form_title', label: __('Form title', 'subtleforms') },
      ],
    },
    {
      id: 'submission',
      title: __('Submission', 'subtleforms'),
      items: [
        { key: 'submission_id', label: __('Entry ID', 'subtleforms') },
        { key: 'created_at', label: __('Submitted date', 'subtleforms') },
        { key: 'status', label: __('Status', 'subtleforms') },
        { key: 'page_url', label: __('Page URL', 'subtleforms') },
        { key: 'ip_address', label: __('IP address', 'subtleforms') },
        { key: 'user_agent', label: __('User agent', 'subtleforms') },
        { key: 'user_id', label: __('User ID', 'subtleforms') },
      ],
    },
    {
      id: 'payment',
      title: __('Payment', 'subtleforms'),
      items: [
        { key: 'payment_amount', label: __('Amount', 'subtleforms') },
        { key: 'payment_currency', label: __('Currency', 'subtleforms') },
        { key: 'payment_status', label: __('Payment status', 'subtleforms') },
      ],
    },
  ];
}

/**
 * Keys that make sense for this form: the answers it has and, only when it
 * takes a payment, the payment group.
 *
 * @param {Array}   fields     collectPayloadFields() result.
 * @param {boolean} hasPayment Whether the form takes a payment.
 * @return {string[]} Every key that can be ticked.
 */
export function knownKeys(fields, hasPayment) {
  return [
    ...FORM_KEYS,
    ...SUBMISSION_KEYS,
    ...(hasPayment ? PAYMENT_KEYS : []),
    ...fields.map((f) => FIELD_PREFIX + f.key),
    LABELS_OPTION,
  ];
}

/**
 * A new webhook starts with the form, the entry and every answer ticked.
 *
 * @param {Array} fields collectPayloadFields() result.
 * @return {string[]} Keys.
 */
export function defaultSelection(fields) {
  return [...FORM_KEYS, 'submission_id', 'created_at', ...fields.map((f) => FIELD_PREFIX + f.key)];
}

/**
 * What the standard full body is in ticks: what an existing webhook sent
 * before, as far as the picker can express it.
 *
 * @param {Array} fields collectPayloadFields() result.
 * @return {string[]} Keys.
 */
export function fullSelection(fields) {
  return [...defaultSelection(fields), LABELS_OPTION];
}

/**
 * Keep the keys that are known and drop the rest, in picker order.
 *
 * @param {string[]} selection Saved keys.
 * @param {Array}    fields    collectPayloadFields() result.
 * @param {boolean}  hasPayment Whether the form takes a payment.
 * @return {string[]} Keys.
 */
export function cleanSelection(selection, fields, hasPayment = true) {
  const set = new Set(Array.isArray(selection) ? selection.map(String) : []);
  return knownKeys(fields, hasPayment).filter((k) => set.has(k));
}

// ─── Example body ───────────────────────────────────────────────────────────

/**
 * An example answer for a field type.
 *
 * @param {Object} field Field from collectPayloadFields().
 * @return {*} Example value.
 */
export function sampleValue(field) {
  switch (field.type) {
    case 'email':
      return 'name@example.com';
    case 'number':
    case 'rating':
    case 'scale':
    case 'range_slider':
    case 'net_promoter_score':
      return 5;
    case 'phone':
    case 'tel':
      return '+1 555 0100';
    case 'url':
    case 'website':
      return 'https://example.com';
    case 'date':
      return '2026-01-15';
    case 'time':
      return '09:30';
    case 'datetime':
      return '2026-01-15 09:30';
    case 'textarea':
    case 'rich_text':
      return 'A longer example answer.';
    case 'consent':
    case 'toggle':
      return 'Yes';
    case 'checkbox':
    case 'checkboxes':
    case 'multi_select':
    case 'multiselect':
      return ['Option 1', 'Option 2'];
    case REPEATER:
      return [Object.fromEntries((field.children || []).map((c) => [c.key, sampleValue(c)]))];
    default:
      return field.type === 'text' ? __('Example text', 'subtleforms') : __('Example answer', 'subtleforms');
  }
}

/**
 * Example entry details shown in the preview.
 *
 * @param {Object} info { formId, formTitle, siteUrl }.
 * @return {Object} Values for every entry key.
 */
export function sampleEntry({ formId = 0, formTitle = '', siteUrl = 'https://example.com' } = {}) {
  return {
    form_id: Number(formId) || 0,
    form_title: formTitle || __('Untitled form', 'subtleforms'),
    submission_id: 1024,
    created_at: '2026-01-15T09:30:00+00:00',
    status: 'completed',
    page_url: `${String(siteUrl).replace(/\/+$/, '')}/contact/`,
    ip_address: '203.0.113.10',
    user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    user_id: 0,
    payment_amount: 49.99,
    payment_currency: 'USD',
    payment_status: 'paid',
  };
}

/**
 * The JSON body for ticked keys, for an example entry. It has the same keys
 * and order as the body the server sends.
 *
 * @param {string[]} selection Ticked keys.
 * @param {Array}    fields    collectPayloadFields() result.
 * @param {Object}   entry     sampleEntry() result.
 * @return {Object} Body.
 */
export function buildPreview(selection, fields, entry) {
  const picked = new Set(selection);
  const body = { event: 'submission.created' };
  [...FORM_KEYS, ...SUBMISSION_KEYS].forEach((key) => {
    if (picked.has(key)) body[key] = entry[key];
  });
  const chosen = fields.filter((f) => picked.has(FIELD_PREFIX + f.key));
  if (chosen.length) {
    body.fields = Object.fromEntries(chosen.map((f) => [f.key, sampleValue(f)]));
    if (picked.has(LABELS_OPTION)) {
      body.answers = chosen.map((f) => ({ key: f.key, label: f.label, value: sampleValue(f) }));
    }
  }
  const payment = {};
  PAYMENT_KEYS.forEach((key) => {
    if (picked.has(key)) payment[key.replace(/^payment_/, '')] = entry[key];
  });
  if (Object.keys(payment).length) body.payment = payment;
  return body;
}

/**
 * The example answers the test request sends with the form's fields.
 *
 * @param {Array} fields collectPayloadFields() result.
 * @return {Object} Key to example value.
 */
export function sampleAnswers(fields) {
  return Object.fromEntries(fields.map((f) => [f.key, sampleValue(f)]));
}

// ─── Checkboxes <-> JSON template ───────────────────────────────────────────

const ENTRY_TAGS = {
  form_title: '{{form_title}}',
  submission_id: '{{entry_id}}',
};

const entryTag = (key) => ENTRY_TAGS[key] || `{{entry:${key}}}`;

const fieldTag = (field) => (SCALAR_TYPES.includes(field.type) ? `{{field:${field.key}}}` : `{{raw:${field.key}}}`);

/**
 * The checkbox selection as a JSON template with merge tags. Saving it as a
 * custom body sends the same data.
 *
 * @param {string[]} selection Ticked keys.
 * @param {Array}    fields    collectPayloadFields() result.
 * @return {string} Pretty JSON.
 */
export function selectionToTemplate(selection, fields) {
  const picked = new Set(selection);
  const out = { event: 'submission.created' };
  [...FORM_KEYS, ...SUBMISSION_KEYS].forEach((key) => {
    if (picked.has(key)) out[key] = entryTag(key);
  });
  const chosen = fields.filter((f) => picked.has(FIELD_PREFIX + f.key));
  if (chosen.length) {
    out.fields = Object.fromEntries(chosen.map((f) => [f.key, fieldTag(f)]));
    if (picked.has(LABELS_OPTION)) {
      out.answers = chosen.map((f) => ({ key: f.key, label: f.label, value: fieldTag(f) }));
    }
  }
  const payment = {};
  PAYMENT_KEYS.forEach((key) => {
    if (picked.has(key)) payment[key.replace(/^payment_/, '')] = entryTag(key);
  });
  if (Object.keys(payment).length) out.payment = payment;
  return JSON.stringify(out, null, 2);
}

/**
 * Read a JSON template back into ticks. Only a template made of the known
 * keys and tags converts; anything else is a custom body and stays one.
 *
 * @param {string} text    Template text.
 * @param {Array}  fields  collectPayloadFields() result.
 * @param {boolean} hasPayment Whether the form takes a payment.
 * @return {{kind: 'selection', selection: string[]}|{kind: 'custom', reason: string}} Result.
 */
export function templateToSelection(text, fields, hasPayment = true) {
  const custom = (reason) => ({ kind: 'custom', reason });
  let doc;
  try {
    doc = JSON.parse(String(text ?? ''));
  } catch (e) {
    return custom(__('The JSON is not valid yet.', 'subtleforms'));
  }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return custom(__('The body is not a JSON object.', 'subtleforms'));
  if (doc.event !== 'submission.created') return custom(__('The body does not start with the standard "event" entry.', 'subtleforms'));

  const byKey = Object.fromEntries(fields.map((f) => [f.key, f]));
  const selection = [];
  for (const [name, value] of Object.entries(doc)) {
    if (name === 'event') continue;
    if ([...FORM_KEYS, ...SUBMISSION_KEYS].includes(name)) {
      if (value !== entryTag(name)) return custom(__('A value was changed from its standard tag.', 'subtleforms'));
      selection.push(name);
    } else if (name === 'fields') {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return custom(__('"fields" must be an object.', 'subtleforms'));
      for (const [key, tag] of Object.entries(value)) {
        const field = byKey[key];
        if (!field) return custom(__('The body uses a field that is not on this form.', 'subtleforms'));
        if (tag !== fieldTag(field)) return custom(__('A field value was changed from its standard tag.', 'subtleforms'));
        selection.push(FIELD_PREFIX + key);
      }
    } else if (name === 'answers') {
      if (!Array.isArray(value)) return custom(__('"answers" must be a list.', 'subtleforms'));
      const listed = value.map((row) => row && row.key);
      for (const row of value) {
        const field = row && byKey[row.key];
        if (!field || row.label !== field.label || row.value !== fieldTag(field) || Object.keys(row).length !== 3) {
          return custom(__('The labelled answers list was changed.', 'subtleforms'));
        }
      }
      if (!doc.fields || listed.length !== Object.keys(doc.fields).length || listed.some((k) => !(k in doc.fields))) {
        return custom(__('The labelled answers list does not match the fields.', 'subtleforms'));
      }
      selection.push(LABELS_OPTION);
    } else if (name === 'payment') {
      if (!hasPayment || !value || typeof value !== 'object' || Array.isArray(value)) return custom(__('The payment details were changed.', 'subtleforms'));
      for (const [sub, tag] of Object.entries(value)) {
        const key = `payment_${sub}`;
        if (!PAYMENT_KEYS.includes(key) || tag !== entryTag(key)) return custom(__('The payment details were changed.', 'subtleforms'));
        selection.push(key);
      }
    } else {
      return custom(__('The body has an entry that the checkboxes cannot show.', 'subtleforms'));
    }
  }
  return { kind: 'selection', selection: cleanSelection(selection, fields, hasPayment) };
}

// ─── Example of a custom body ───────────────────────────────────────────────

const TAG = /\{\{\s*([a-zA-Z0-9_:.-]+)\s*\}\}|\{([a-zA-Z0-9_:.-]+)\}/g;

/**
 * Fill the merge tags of a JSON template with example values, the way the
 * server does for a custom body (WebhookAction::fillCustomPayload). Lists
 * are empty text in {{field:key}} and whole in {{raw:key}}.
 *
 * @param {string} text   Template text.
 * @param {Array}  fields collectPayloadFields() result.
 * @param {Object} entry  sampleEntry() result.
 * @return {{ok: true, value: *}|{ok: false, error: string}} Result.
 */
export function renderTemplate(text, fields, entry) {
  let doc;
  try {
    doc = JSON.parse(String(text ?? '').trim() || '{}');
  } catch (e) {
    return { ok: false, error: __('The JSON is not valid yet, so there is no example to show.', 'subtleforms') };
  }
  const answers = sampleAnswers(fields);
  const scalar = (value) => (['string', 'number', 'boolean'].includes(typeof value) ? String(value) : null);

  const resolve = (name) => {
    if (name === 'form_title') return entry.form_title;
    if (name === 'entry_id') return String(entry.submission_id);
    if (name === 'date') return entry.created_at;
    if (name.startsWith('entry:')) {
      const key = name.slice(6);
      return key in entry ? String(entry[key]) : '';
    }
    const key = name.startsWith('field:') ? name.slice(6) : name;
    if (key in answers) return scalar(answers[key]) ?? '';
    return name.startsWith('field:') ? '' : null;
  };

  const fill = (value) => {
    if (Array.isArray(value)) return value.map(fill);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fill(v)]));
    if (typeof value !== 'string' || !value.includes('{')) return value;
    const exact = value.match(/^\{\{\s*raw:([^\s}]+)\s*\}\}$/);
    if (exact) return exact[1] in answers ? answers[exact[1]] : null;
    return value.replace(TAG, (whole, double, single) => {
      const found = resolve(double || single);
      if (found === null) return double ? '' : whole;
      return found;
    });
  };
  return { ok: true, value: fill(doc) };
}

/**
 * The standard body an existing webhook sends in "full" mode, for the same
 * example entry (Webhooks::fullBody).
 *
 * @param {Array}  fields collectPayloadFields() result.
 * @param {Object} entry  sampleEntry() result.
 * @param {string} siteUrl Site address.
 * @return {Object} Body.
 */
export function buildFullPreview(fields, entry, siteUrl = 'https://example.com') {
  const site = `${String(siteUrl).replace(/\/+$/, '')}/`;
  return {
    event: 'submission.created',
    form_id: entry.form_id,
    form_title: entry.form_title,
    submission_id: entry.submission_id,
    created_at: entry.created_at,
    site_url: site,
    entry_url: `${site}wp-admin/admin.php?page=subtleforms-submissions&submission_id=${entry.submission_id}`,
    fields: Object.fromEntries(fields.map((f) => [f.key, sampleValue(f)])),
    answers: fields.map((f) => ({ key: f.key, label: f.label, value: sampleValue(f) })),
  };
}
