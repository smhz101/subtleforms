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

// Auto-mount forms on page load
document.addEventListener('DOMContentLoaded', () => {
  // Mount shortcode containers
  const shortcodeContainers = document.querySelectorAll(
    '.subtleforms-form-container'
  );
  shortcodeContainers.forEach((container) => {
    const formId = parseInt(container.dataset.formId, 10);
    if (formId) {
      mount(container, { formId });
    }
  });

  // Mount block containers
  const blockContainers = document.querySelectorAll('.subtleforms-block');
  blockContainers.forEach((container) => {
    const formId = parseInt(container.dataset.formId, 10);
    if (formId) {
      mount(container, { formId });
    }
  });
});
