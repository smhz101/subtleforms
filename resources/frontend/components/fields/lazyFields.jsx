/**
 * Field code that is only downloaded when a form needs it (2.6.0).
 *
 * The main front-end bundle holds the form and the everyday fields. The date
 * picker, the phone and country pickers (with the country list), uploads,
 * payments, repeaters, chained selects, the rich text editor and the
 * conversational layout each live in their own file and are fetched only for
 * a form that has them.
 *
 * The form asks for what it needs as soon as it knows (the server lists it in
 * the container's data-features, the schema confirms it) and draws the whole
 * form once that code is in, so visitors never see a field pop in later. A
 * field that is rendered before its code arrived (for example one just added
 * in the builder preview) shows a small loading line until it is ready.
 */
import { __ } from '@wordpress/i18n';
import { lazy, Suspense, useState } from '@wordpress/element';
import { fieldConfig } from '../../../shared/fieldConfig';
import { structuralType } from '../../../shared/formType';

const LOADERS = {
  date: () => import(/* webpackChunkName: "field-date" */ './DateTimeField'),
  geo: () => import(/* webpackChunkName: "field-phone-country" */ './geoFields'),
  upload: () => import(/* webpackChunkName: "field-upload" */ './FileUpload'),
  repeater: () => import(/* webpackChunkName: "field-repeater" */ './RepeaterField'),
  chained: () => import(/* webpackChunkName: "field-chained-select" */ './ChainedSelect'),
  richText: () => import(/* webpackChunkName: "field-rich-text" */ './RichTextInput'),
  conversational: () =>
    import(/* webpackChunkName: "form-conversational" */ '../ConversationalFormRenderer'),
};

/** Group names, in a stable order. */
export const FIELD_GROUPS = Object.keys(LOADERS);

const TYPE_GROUPS = {
  date: 'date',
  time: 'date',
  datetime: 'date',
  country: 'geo',
  address_group: 'geo',
  file_upload: 'upload',
  image_upload: 'upload',
  repeat_container: 'repeater',
  chained_select: 'chained',
  rich_text: 'richText',
};

/** Loaded modules by group. */
const modules = {};
/** Downloads in flight by group. */
const pending = {};

/**
 * The group a field's code is in, or '' for a field in the main bundle.
 *
 * @param {Object} field Schema field.
 * @return {string} Group name.
 */
export function fieldGroup(field) {
  if (!field || typeof field !== 'object') {
    return '';
  }
  if ((field.type === 'phone' || field.type === 'tel') && fieldConfig(field).enableCountryCode) {
    return 'geo';
  }
  return TYPE_GROUPS[field.type] || '';
}

/**
 * Every group a schema needs, nested fields included.
 *
 * @param {Object} schema Form schema.
 * @return {Set<string>} Group names.
 */
export function fieldGroups(schema) {
  const groups = new Set();
  if (!schema || typeof schema !== 'object') {
    return groups;
  }
  if (structuralType(schema) === 'conversational') {
    groups.add('conversational');
  }
  const seen = new Set();
  const walk = (node) => {
    if (!node || typeof node !== 'object' || seen.has(node)) {
      return;
    }
    seen.add(node);
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    const group = fieldGroup(node);
    if (group) {
      groups.add(group);
    }
    ['fields', 'children', 'columns'].forEach((key) => walk(node[key]));
    if (node.config && typeof node.config === 'object') {
      ['fields', 'children', 'columns'].forEach((key) => walk(node.config[key]));
    }
  };
  walk(schema.fields);
  return groups;
}

/**
 * Download one group (once).
 *
 * @param {string} name Group name.
 * @return {Promise<Object|null>} The module, or null for an unknown group.
 */
export function loadGroup(name) {
  if (modules[name]) {
    return Promise.resolve(modules[name]);
  }
  if (!LOADERS[name]) {
    return Promise.resolve(null);
  }
  if (!pending[name]) {
    pending[name] = LOADERS[name]().then(
      (mod) => {
        modules[name] = mod;
        return mod;
      },
      (err) => {
        // Let a later render try again.
        delete pending[name];
        throw err;
      }
    );
  }
  return pending[name];
}

/**
 * Download several groups. Never rejects: a group that fails to download is
 * tried again by the field itself when it renders.
 *
 * @param {Iterable<string>} names Group names.
 * @return {Promise<void>}
 */
export function loadGroups(names) {
  return Promise.all(
    [...(names || [])].map((name) => loadGroup(name).catch(() => null))
  ).then(() => undefined);
}

/**
 * Download what a schema needs.
 *
 * @param {Object} schema Form schema.
 * @return {Promise<void>}
 */
export function loadFieldsFor(schema) {
  return loadGroups(fieldGroups(schema));
}

/**
 * Whether every group a schema needs is already here.
 *
 * @param {Object} schema Form schema.
 * @return {boolean}
 */
export function fieldsReadyFor(schema) {
  return [...fieldGroups(schema)].every((name) => !!modules[name]);
}

/**
 * Groups listed by the server on a form container (data-features).
 *
 * @param {HTMLElement} container Form container.
 * @return {string[]} Known group names.
 */
export function containerGroups(container) {
  const raw = container?.dataset?.features || '';
  return raw.split(/\s+/).filter((name) => !!LOADERS[name]);
}

/** Placeholder while a field's code downloads. */
export function FieldLoading() {
  return (
    <div className='subtleforms-field-loading' aria-busy='true'>
      {__('Loading…', 'subtleforms')}
    </div>
  );
}

/**
 * A component from a group, drawn straight away when its code is here and
 * through Suspense otherwise. Which of the two is decided once per mounted
 * field, so a field never remounts when the download finishes.
 *
 * @param {string}   group      Group name.
 * @param {string}   exportName Export of the group's module.
 * @param {Function} Fallback   Shown while downloading.
 * @return {Function} Component.
 */
export function lazyField(group, exportName = 'default', Fallback = FieldLoading) {
  const Lazy = lazy(() =>
    loadGroup(group).then((mod) => ({ default: mod[exportName] }))
  );
  function LazyField(props) {
    const [ready] = useState(() => !!modules[group]);
    if (ready) {
      const Component = modules[group][exportName];
      return <Component {...props} />;
    }
    return (
      <Suspense fallback={<Fallback />}>
        <Lazy {...props} />
      </Suspense>
    );
  }
  LazyField.displayName = `LazyField(${group}.${exportName})`;
  return LazyField;
}

/** Test helper: download every group. */
export function loadAllFieldGroups() {
  return loadGroups(FIELD_GROUPS);
}
