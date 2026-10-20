import { createRoot } from '@wordpress/element';
import FormRenderer from './components/FormRenderer';
import FormErrorBoundary from './components/FormErrorBoundary';
import './frontend.css';
import './styles/frontend.scss';
import { debug } from '../shared/debug';
import { observeView } from './utils/viewBeacon';

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
  const { formId, schema, preview = false, onSubmit, blockOptions } = options;

  if (!formId) {
    console.error('SubtleForms: formId is required for mount()');
    return;
  }

  container.removeAttribute('aria-busy');

  const root = createRoot(container);
  root.render(
    <FormErrorBoundary>
      <FormRenderer
        formId={formId}
        preloadedSchema={schema}
        preview={preview}
        onSubmit={onSubmit}
        blockOptions={blockOptions}
      />
    </FormErrorBoundary>
  );

  // Store root reference for cleanup
  container._subtleformsRoot = root;
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
}

// Expose public API
window.SubtleForms = {
  mount,
  unmount,
};

// Auto-mount function
function autoMountForms() {
  debug('SubtleForms: Auto-mounting forms...');

  // Mount shortcode containers
  const shortcodeContainers = document.querySelectorAll(
    '.subtleforms-form-container'
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
      observeView(container, formId, window.subtleformsFrontend || {});
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
      observeView(container, formId, window.subtleformsFrontend || {});
    }
  });
}

// Auto-mount forms when DOM is fully ready (frontend only, not in editor)
// Use 'DOMContentLoaded' to ensure all dependencies (wp-element) are loaded
debug(
  'SubtleForms: Script loaded, document.readyState:',
  document.readyState
);

// Don't auto-mount in the block editor - the editor uses manual mounting for preview
const isBlockEditor = typeof window.wp !== 'undefined' && window.wp.blockEditor;

if (!isBlockEditor) {
  if (document.readyState === 'loading') {
    // Still loading, wait for DOMContentLoaded
    document.addEventListener('DOMContentLoaded', autoMountForms);
  } else if (document.readyState === 'interactive') {
    // DOM parsed but resources still loading, wait for full load
    window.addEventListener('load', autoMountForms);
  } else {
    // DOM and all resources loaded, run immediately
    autoMountForms();
  }
} else {
  debug('SubtleForms: Block editor detected, skipping auto-mount');
}
