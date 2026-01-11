import { createRoot } from '@wordpress/element';
import FormRenderer from './components/FormRenderer';
import './frontend.css';

/**
 * Mount a form renderer in a container
 *
 * @param {HTMLElement} container - DOM element to mount into
 * @param {Object} options - Mount options
 * @param {number} options.formId - Form ID to render
 * @param {Object} [options.schema] - Pre-loaded schema (optional)
 * @param {boolean} [options.preview] - Preview mode (read-only)
 * @param {Function} [options.onSubmit] - Custom submit handler
 */
function mount(container, options = {}) {
  const { formId, schema, preview = false, onSubmit } = options;

  if (!formId) {
    console.error('SubtleForms: formId is required for mount()');
    return;
  }

  const root = createRoot(container);
  root.render(
    <FormRenderer
      formId={formId}
      preloadedSchema={schema}
      preview={preview}
      onSubmit={onSubmit}
    />
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
  console.log('SubtleForms: Auto-mounting forms...');

  // Mount shortcode containers
  const shortcodeContainers = document.querySelectorAll(
    '.subtleforms-form-container'
  );
  console.log(
    `SubtleForms: Found ${shortcodeContainers.length} shortcode containers`
  );
  shortcodeContainers.forEach((container) => {
    const formId = parseInt(container.dataset.formId, 10);
    if (formId) {
      console.log(
        `SubtleForms: Mounting form ${formId} in shortcode container`
      );
      mount(container, { formId });
    }
  });

  // Mount block containers
  const blockContainers = document.querySelectorAll('.subtleforms-block');
  console.log(`SubtleForms: Found ${blockContainers.length} block containers`);
  blockContainers.forEach((container) => {
    const formId = parseInt(container.dataset.formId, 10);
    if (formId) {
      console.log(`SubtleForms: Mounting form ${formId} in block container`);
      mount(container, { formId });
    }
  });
}

// Auto-mount forms when DOM is fully ready (frontend only, not in editor)
// Use 'DOMContentLoaded' to ensure all dependencies (wp-element) are loaded
console.log(
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
  console.log('SubtleForms: Block editor detected, skipping auto-mount');
}
