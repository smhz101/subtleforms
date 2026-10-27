// Must stay first: where the field code files are loaded from (2.6.0).
import './utils/setPublicPath';
import { createRoot } from '@wordpress/element';
import { releaseReserve } from './utils/reserve';
import FormRenderer from './components/FormRenderer';
import FormErrorBoundary from './components/FormErrorBoundary';
import './frontend.css';
import './styles/frontend.scss';
import { debug } from '../shared/debug';
import { containerGroups, loadGroups, loadFieldsFor } from './components/fields/lazyFields';
import { readInlineFormData } from './utils/inlineData';
import { restFetch } from './utils/restFetch';
import { runFormMountHooks } from '../shared/extend';

/**
 * Resolve the public schema (and spam token) before the first paint so the
 * server outline is never replaced with a loading line.
 *
 * @param {number} formId
 * @param {Object|null} optionSchema
 * @return {Promise<{schema: Object|null, spamToken: string}>}
 */
async function resolveSchema(formId, optionSchema) {
  if (optionSchema) {
    return { schema: optionSchema, spamToken: '' };
  }
  const inline = readInlineFormData(formId);
  if (inline) {
    return { schema: inline.schema, spamToken: inline.spamToken || '' };
  }
  const res = await restFetch(`/forms/${formId}/schema`);
  const data = await res.json();
  return {
    schema: data?.data?.schema ?? data?.schema ?? null,
    spamToken: data?.data?.spam_token || data?.spam_token || '',
  };
}

/**
 * Mount a form renderer in a container
 *
 * @param {HTMLElement} container - DOM element to mount into
 * @param {Object} options - Mount options
 * @param {number} options.formId - Form ID to render
 * @param {Object} [options.schema] - Pre-loaded schema (optional)
 * @param {boolean} [options.preview] - Preview mode (read-only)
 * @param {Function} [options.onSubmit] - Custom submit handler
 * @param {Object} [options.blockOptions] - Block-level options (theme,
 *   showTitle, showDescription, ajax, tabIndex, fieldValues) forwarded from
 *   the Gutenberg block or shortcode.
 */
function mount(container, options = {}) {
  const { formId, schema: optionSchema } = options;

  if (!formId) {
    console.error('SubtleForms: formId is required for mount()');
    return;
  }

  // A container that already has a form gets the new options on the same
  // root: a second root would draw the form twice and load it twice.
  const existing = container._subtleformsRoot;
  const root = existing || createRoot(container);
  container._subtleformsRoot = root;

  const draw = (opts, schema, spamToken) => {
    // Unmounted while the field code was downloading.
    if (!existing && container._subtleformsRoot !== root) {
      return;
    }
    const {
      formId: drawFormId,
      preview: drawPreview = false,
      onSubmit: drawOnSubmit,
      blockOptions: drawBlockOptions,
    } = opts;
    root.render(
      <FormErrorBoundary>
        <FormRenderer
          formId={drawFormId}
          preloadedSchema={schema || null}
          preloadedSpamToken={spamToken || ''}
          preview={drawPreview}
          onSubmit={drawOnSubmit}
          blockOptions={drawBlockOptions}
        />
      </FormErrorBoundary>
    );
  };

  // Remounts keep the live tree; FormRenderer loads if no schema is handed in.
  // While the first paint is still preparing, keep the latest options for draw.
  if (existing) {
    if (container._subtleformsPreparing) {
      container._subtleformsPendingMount = options;
      return;
    }
    draw(options, optionSchema || null, '');
    return;
  }

  // First mount: keep the server outline until schema and field code are ready,
  // then paint once. createRoot does not clear the container until render.
  container._subtleformsPreparing = (async () => {
    let schema = null;
    let spamToken = '';
    try {
      const resolved = await resolveSchema(formId, optionSchema || null);
      schema = resolved.schema;
      spamToken = resolved.spamToken;
    } catch (e) {
      // Fall through: paint without a preload so FormRenderer can show the error.
      schema = null;
      spamToken = '';
    }

    await loadGroups(containerGroups(container));
    if (schema) {
      await loadFieldsFor(schema);
    }

    if (container._subtleformsRoot !== root) {
      return;
    }

    const pending = container._subtleformsPendingMount;
    delete container._subtleformsPendingMount;

    if (pending) {
      let pendingSchema = null;
      let pendingSpam = '';
      try {
        const resolved = await resolveSchema(pending.formId, pending.schema || null);
        pendingSchema = resolved.schema;
        pendingSpam = resolved.spamToken;
      } catch (e) {
        pendingSchema = null;
        pendingSpam = '';
      }
      if (pendingSchema) {
        await loadFieldsFor(pendingSchema);
      }
      if (container._subtleformsRoot !== root) {
        return;
      }
      draw(pending, pendingSchema, pendingSpam);
    } else {
      draw(options, schema, spamToken);
    }
    releaseReserve(container);
  })().finally(() => {
    delete container._subtleformsPreparing;
  });
}

/**
 * Unmount a form renderer from a container
 *
 * @param {HTMLElement} container - DOM element to unmount from
 */
function unmount(container) {
  if (container._subtleformsRoot) {
    container._subtleformsRoot.unmount();
    delete container._subtleformsRoot;
  }
  delete container._subtleformsPreparing;
  delete container._subtleformsPendingMount;
}

// Expose public API
window.SubtleForms = {
  mount,
  unmount,
};

// Auto-mount function
function autoMountForms() {
  debug('SubtleForms: Auto-mounting forms...');

  // Mount shortcode containers. Block containers carry this class too (for
  // the shared width) and are mounted below with their block options.
  const shortcodeContainers = document.querySelectorAll(
    '.subtleforms-form-container:not(.subtleforms-block)'
  );
  debug(
    `SubtleForms: Found ${shortcodeContainers.length} shortcode containers`
  );
  shortcodeContainers.forEach((container) => {
    const formId = parseInt(container.dataset.formId, 10);
    if (formId) {
      debug(
        `SubtleForms: Mounting form ${formId} in shortcode container`
      );
      mount(container, { formId });
      runFormMountHooks({ container, formId, config: window.subtleformsFrontend || {} });
    }
  });

  // Mount block containers
  const blockContainers = document.querySelectorAll('.subtleforms-block');
  debug(`SubtleForms: Found ${blockContainers.length} block containers`);
  blockContainers.forEach((container) => {
    const formId = parseInt(container.dataset.formId, 10);
    if (formId) {
      debug(`SubtleForms: Mounting form ${formId} in block container`);
      // Forward block-level options from data attributes so the renderer can
      // apply the chosen theme, title/description visibility, AJAX mode, tab
      // index and prefilled field values.
      const blockOptions = {
        theme: container.dataset.theme || 'default',
        showTitle: container.dataset.showTitle !== '0',
        showDescription: container.dataset.showDescription !== '0',
        ajax: container.dataset.ajax === '1',
        tabIndex: parseInt(container.dataset.tabindex, 10) || 0,
        fieldValues: container.dataset.fieldValues || '',
        // Outcome of a post without AJAX that just returned here (2.4.0).
        classicResult: container.dataset.classicResult || '',
      };
      mount(container, { formId, blockOptions });
      runFormMountHooks({ container, formId, config: window.subtleformsFrontend || {} });
    }
  });
}

// Auto-mount forms once the page is parsed (frontend only, not in editor).
// The script is deferred (2.6.0), so it usually runs while the document is
// "interactive" and DOMContentLoaded has not fired yet; waiting for it lets
// add-on scripts that load after this one register their fields first.
// "load" is the fallback for a script added after DOMContentLoaded.
debug(
  'SubtleForms: Script loaded, document.readyState:',
  document.readyState
);

// Don't auto-mount in the block editor - the editor uses manual mounting for preview
const isBlockEditor = typeof window.wp !== 'undefined' && window.wp.blockEditor;

if (!isBlockEditor) {
  if (document.readyState === 'complete') {
    autoMountForms();
  } else {
    let mounted = false;
    const once = () => {
      if (!mounted) {
        mounted = true;
        autoMountForms();
      }
    };
    document.addEventListener('DOMContentLoaded', once);
    window.addEventListener('load', once);
  }
} else {
  debug('SubtleForms: Block editor detected, skipping auto-mount');
}
