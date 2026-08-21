import FormPreviewBody from './form-preview/FormPreviewBody';
import './FormPreviewModal.scss';

/**
 * Inline preview pane for the builder's preview tab.
 *
 * Chrome only — the rendering is FormPreviewBody, which is shared with the
 * preview modal so both show identical output.
 */
export default function FormPreviewPane( { schema, isDirty = false } ) {
  return <FormPreviewBody schema={ schema } isDirty={ isDirty } />;
}
