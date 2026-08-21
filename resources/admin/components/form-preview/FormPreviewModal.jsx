import { Modal } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import Icon from '../../ui/Icon';
import FormPreviewHeader from './FormPreviewHeader';
import FormPreviewBody from './FormPreviewBody';
import '../FormPreviewModal.scss';

/**
 * Form preview overlay.
 *
 * Chrome only. The form itself is rendered by FormPreviewBody, which runs the
 * real frontend renderer in preview mode, so this shows exactly what a visitor
 * will get — including conversational and multi-step behaviour, which the
 * previous hand-written preview could only approximate.
 *
 * Always previews the draft schema passed in, never the published one.
 */
export default function FormPreviewModal( { schema, onClose, isDirty = false } ) {
  if ( ! schema || ! schema.fields ) {
    return null;
  }

  return (
    <Modal
      title={
        <div className='sf-form-preview-modal__title-bar'>
          <span>{ __( 'Preview', 'subtleforms' ) }</span>
          <button
            onClick={ onClose }
            className='sf-form-preview-modal__close-btn'
            aria-label={ __( 'Close preview', 'subtleforms' ) }>
            <Icon.Close aria-hidden='true' />
          </button>
        </div>
      }
      onRequestClose={ onClose }
      className='subtleforms-preview-modal'
      style={ { maxWidth: '700px', width: '100%' } }
      aria-labelledby='form-preview-title'>
      <div className='sf-form-preview-modal__container'>
        <FormPreviewHeader metadata={ schema.metadata } isDirty={ isDirty } />
        <FormPreviewBody schema={ schema } />
      </div>
    </Modal>
  );
}
