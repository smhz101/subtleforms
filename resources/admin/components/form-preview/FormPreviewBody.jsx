import { __ } from '@wordpress/i18n';
import FormRenderer from '../../../frontend/components/FormRenderer';
import FormErrorBoundary from '../../../frontend/components/FormErrorBoundary';
import PreviewFrame from './PreviewFrame';

/**
 * The builder preview.
 *
 * Renders the same FormRenderer the public page uses, in preview mode, inside
 * an iframe carrying the public stylesheet. Multi-step navigation, conversational
 * mode, conditional logic and every field type therefore behave exactly as they
 * will for a visitor, because it is the same code — not a second implementation
 * kept in sync by hand.
 *
 * `preview` makes FormRenderer refuse to submit, so nothing reaches the API.
 */
export default function FormPreviewBody( { schema, isDirty = false } ) {
  if ( ! schema || ! schema.fields ) {
    return (
      <div className='sf-form-preview__empty'>
        { __( 'Add a field to see the preview.', 'subtleforms' ) }
      </div>
    );
  }

  return (
    <div className='sf-form-preview'>
      { isDirty && (
        <p className='sf-form-preview__notice' role='status'>
          { __(
            'Previewing unsaved changes. Publish to make them live.',
            'subtleforms'
          ) }
        </p>
      ) }
      <PreviewFrame
        className='sf-form-preview__frame'
        title={ __( 'Form preview', 'subtleforms' ) }>
        <FormErrorBoundary>
          <FormRenderer preloadedSchema={ schema } preview />
        </FormErrorBoundary>
      </PreviewFrame>
    </div>
  );
}
