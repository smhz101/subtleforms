// Must stay first: where the field code files are loaded from (2.6.0).
import './utils/setPublicPath';
import { createRoot } from '@wordpress/element';
import { releaseReserve } from './utils/reserve';
import FormRenderer from './components/FormRenderer';
import FormErrorBoundary from './components/FormErrorBoundary';
import './frontend.css';
import './styles/frontend.scss';
import { debug } from '../shared/debug';
import { observeView } from './utils/viewBeacon';
import { containerGroups, loadGroups } from './components/fields/lazyFields';
import { readInlineFormData } from './utils/inlineData';
import { trackFunnel } from './utils/funnelTracker';

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

  // Start downloading the code of this form's heavier fields now, while the
  // form itself loads (2.6.0). The server lists them in data-features.
  const fieldCode = loadGroups(containerGroups(container));

  // A container that already has a form gets the new options on the same
  // root: a second root would draw the form twice and load it twice.
  const existing = container._subtleformsRoot;
  const root = existing || createRoot(container);
  // Store root reference for cleanup
  container._subtleformsRoot = root;
  const draw = () => {
    // Unmounted while the field code was downloading.
    if (!existing && container._subtleformsRoot !== root) {
      return;
    }
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
  };
  // A form whose data the server printed (2.6.1) keeps the server-drawn
  // outline in the container until the form can replace it in one go, with
  // its field code in, instead of showing a loading line first.
  if (!existing && !schema && readInlineFormData(formId)) {
    fieldCode.then(draw);
  } else {
    draw();
  }
  if (existing) {
    return;
  }

  // Release the height kept for the form once it is drawn (UX2-27).
  releaseReserve(container);
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
      observeView(container, formId, window.subtleformsFrontend || {});
      trackFunnel(container, formId, window.subtleformsFrontend || {});
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
      trackFunnel(container, formId, window.subtleformsFrontend || {});
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
