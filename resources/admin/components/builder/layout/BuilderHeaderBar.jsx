/**
 * BuilderHeaderBar Components
 *
 * Pure UI components for the builder page header with title editing and actions.
 * Split into two components to avoid React hooks violations:
 * - BuilderTitle: Editable title with form type badge
 * - BuilderActions: All action buttons and status indicators
 */

import { useRef } from '@wordpress/element';
import { Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import Icon from '../../ui/Icon';
import HelpMenu from '../../HelpMenu';
import { BUILDER_ACTIONS } from '../../../hooks/useBuilderReducer';
import './BuilderHeaderBar.scss';

/**
 * BuilderTitle - Editable form title with type badge
 */
export function BuilderTitle({
  formTitle,
  isEditingTitle,
  setIsEditingTitle,
  setFormTitle,
  onPersistTitle,
  formTypeBadge,
  FormTypeIcon,
  draftSchema,
}) {
  const titleInputRef = useRef(null);

  return (
    <div className='sf-builder-header-bar__left' data-tour='header'>
      {isEditingTitle ? (
        <input
          ref={titleInputRef}
          type='text'
          value={formTitle}
          onChange={(event) => setFormTitle(event.target.value)}
          onBlur={() => onPersistTitle(formTitle)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              onPersistTitle(formTitle);
            }
            if (event.key === 'Escape') {
              setIsEditingTitle(false);
              setFormTitle(draftSchema?.metadata?.title || formTitle);
            }
          }}
          className='sf-builder-header-bar__title-input'
        />
      ) : (
        <button
          type='button'
          onClick={() => setIsEditingTitle(true)}
          className='sf-builder-header-bar__title-button'
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#2271b1';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = '#1e1e1e';
          }}>
          {formTitle || __('Untitled Form', 'subtleforms')}
        </button>
      )}

      {/** form type */}
      <span
        className={`sf-builder-header-bar__form-type-badge ${
          formTypeBadge.color === 'gray'
            ? 'bg-gray-50 text-gray-700 border-gray-200'
            : formTypeBadge.color === 'purple'
            ? 'bg-purple-50 text-purple-700 border-purple-200'
            : formTypeBadge.color === 'indigo'
            ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
            : formTypeBadge.color === 'blue'
            ? 'bg-blue-50 text-blue-700 border-blue-200'
            : 'bg-green-50 text-green-700 border-green-200'
        }`}
        style={{ borderRadius: '4px' }}
        title={formTypeBadge.label}>
        <FormTypeIcon className='sf-builder-header-bar__form-type-icon' />
        {formTypeBadge.label}
      </span>
    </div>
  );
}

/**
 * BuilderActions - All action buttons and status indicators
 */
export function BuilderActions({
  // Status props
  formStatus,
  shortcode,
  copyState,
  onCopyShortcode,
  statusLabel,
  statusDescription,
  effectiveStatus,
  autoSaving,
  autoSaveError,
  saveError,
  onRetryAutosave,
  onRetryLastManualSave,
  onDismissErrors,

  // Action props
  canUndo,
  canRedo,
  saving,
  dispatch,
  isDirty,
  hasValidationErrors,
  draftSchema,
  onSaveDraft,
  onPublish,
  onSaveAndClose,
  onDelete,
  onPreview,
  onStartTour,
  onOpenWizard,
  showWizard,
}) {
  return (
    <div className='sf-builder-header-bar__center'>
      {/* Status Badge */}
      <span
        data-tour='status-badge'
        className={`sf-builder-header-bar__mode-badge ${
          formStatus === 'published' ? 'bg-green-600' : 'bg-yellow-500'
        }`}
        style={{ borderRadius: '4px' }}
        title={
          formStatus === 'published'
            ? __('Form is live and visible to users', 'subtleforms')
            : __('Form is saved but not published', 'subtleforms')
        }>
        {formStatus === 'published'
          ? __('Published', 'subtleforms')
          : __('Draft', 'subtleforms')}
      </span>

      {/* Shortcode Pill */}
      {shortcode && (
        <button
          type='button'
          onClick={() => onCopyShortcode(shortcode)}
          className={`sf-builder-header-bar__shortcode-button ${
            copyState === 'copied'
              ? 'text-green-700 bg-green-50 border border-green-500'
              : 'sf-text-gray-700 sf-bg-gray-50 sf-border sf-border-gray-300 hover:sf-border-blue-500 hover:sf-bg-blue-50'
          }`}
          style={{ borderRadius: '4px' }}
          title={
            copyState === 'copied'
              ? __('Copied to clipboard!', 'subtleforms')
              : __('Click to copy shortcode', 'subtleforms')
          }>
          {copyState === 'copied' ? (
            <>
              <span>✓</span>
              {__('Copied!', 'subtleforms')}
            </>
          ) : (
            shortcode
          )}
        </button>
      )}

      {/* Save Status Indicator */}
      <div
        className='sf-builder-header-bar__save-status'
        title={statusDescription || undefined}>
        <span
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background:
              autoSaving || effectiveStatus === 'saving'
                ? '#2271b1'
                : effectiveStatus === 'saved'
                ? '#00a32a'
                : effectiveStatus === 'error'
                ? '#d63638'
                : '#f0b849',
            boxShadow:
              autoSaving || effectiveStatus === 'saving'
                ? '0 0 4px rgba(34, 113, 177, 0.5)'
                : 'none',
          }}
        />
        <span
          className={
            effectiveStatus === 'error'
              ? 'text-red-600 font-medium'
              : 'text-gray-700'
          }>
          {statusLabel}
        </span>
      </div>

      {/* Error Actions */}
      {(autoSaveError || saveError) && (
        <div className='sf-builder-header-bar__tour-buttons'>
          {autoSaveError && (
            <Button
              variant='secondary'
              isSmall
              onClick={onRetryAutosave}
              className='sf-builder-header-bar__tour-button'>
              {__('Retry autosave', 'subtleforms')}
            </Button>
          )}
          {saveError && (
            <Button
              variant='secondary'
              isSmall
              onClick={onRetryLastManualSave}
              className='sf-builder-header-bar__tour-button'>
              {__('Retry save', 'subtleforms')}
            </Button>
          )}
          <Button
            variant='tertiary'
            isSmall
            onClick={onDismissErrors}
            className='sf-builder-header-bar__tour-button'>
            {__('Dismiss', 'subtleforms')}
          </Button>
        </div>
      )}

      <div
        style={{
          width: '1px',
          height: '24px',
          background: '#ddd',
          margin: '0 4px',
        }}
      />

      {/* Primary Actions Group */}
      <div className='sf-builder-header-bar__action-buttons'>
        <Button
          variant='tertiary'
          onClick={() => dispatch({ type: BUILDER_ACTIONS.UNDO_SCHEMA })}
          disabled={!canUndo || saving || autoSaving}
          className='sf-builder-header-bar__undo-button'
          title={__('Undo (Ctrl/Cmd+Z)', 'subtleforms')}>
          <Icon.Undo className='sf-builder-header-bar__undo-icon' />
        </Button>

        <Button
          variant='tertiary'
          onClick={() => dispatch({ type: BUILDER_ACTIONS.REDO_SCHEMA })}
          disabled={!canRedo || saving || autoSaving}
          className='sf-builder-header-bar__redo-button'
          title={__('Redo (Shift+Ctrl/Cmd+Z)', 'subtleforms')}>
          <Icon.Redo className='sf-builder-header-bar__redo-icon' />
        </Button>

        <HelpMenu
          onStartTour={onStartTour}
          onOpenWizard={onOpenWizard}
          showWizard={showWizard}
        />

        <Button
          variant='secondary'
          onClick={onPreview}
          disabled={!draftSchema || draftSchema.fields?.length === 0}
          className='sf-builder-header-bar__preview-button'>
          {__('Preview', 'subtleforms')}
        </Button>

        {isDirty && (
          <Button
            variant='secondary'
            onClick={onSaveDraft}
            disabled={saving || autoSaving}
            className='sf-builder-header-bar__settings-button'>
            {saving && !formStatus
              ? __('Saving…', 'subtleforms')
              : __('Save Draft', 'subtleforms')}
          </Button>
        )}

        <Button
          variant='primary'
          data-tour='publish-button'
          onClick={onPublish}
          disabled={saving || autoSaving || hasValidationErrors}
          className='sf-builder-header-bar__save-button'>
          {formStatus === 'published'
            ? __('Update', 'subtleforms')
            : __('Publish', 'subtleforms')}
        </Button>

        <Button
          variant='secondary'
          onClick={onSaveAndClose}
          disabled={saving || autoSaving}
          className='sf-builder-header-bar__close-button'
          title={__('Save changes and return to forms list', 'subtleforms')}>
          {__('Save & Close', 'subtleforms')}
        </Button>

        <Button
          variant='secondary'
          onClick={onDelete}
          isDestructive
          className='sf-builder-header-bar__close-button'
          title={__('Delete this form permanently', 'subtleforms')}>
          {__('Delete', 'subtleforms')}
        </Button>
      </div>
    </div>
  );
}
