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
    <div className='sf-flex sf-items-center sf-gap-3' data-tour='header'>
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
          className='sf-bg-white sf-px-2 sf-py-1 sf-border sf-border-blue-600 sf-outline-none sf-min-w-[200px] sf-font-semibold sf-text-gray-900 sf-text-base'
        />
      ) : (
        <button
          type='button'
          onClick={() => setIsEditingTitle(true)}
          className='sf-bg-transparent sf-px-2 sf-py-1 sf-border-none sf-outline-none sf-font-semibold sf-text-gray-900 hover:sf-text-blue-600 sf-text-base sf-cursor-pointer'
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
        className={`sf-form-type-text sf-inline-flex sf-items-center sf-gap-1.5 sf-px-2.5 sf-py-1 sf-text-xs sf-font-medium sf-border ${
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
        <FormTypeIcon className='sf-w-3 sf-h-3' />
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
    <div className='sf-flex sf-items-center sf-gap-3'>
      {/* Status Badge */}
      <span
        data-tour='status-badge'
        className={`sf-inline-flex sf-items-center sf-px-3 sf-py-1.5 sf-text-xs sf-font-semibold sf-uppercase sf-tracking-wide sf-text-white ${
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
          className={`sf-inline-flex sf-items-center sf-gap-1.5 sf-px-3 sf-py-1.5 sf-text-xs sf-font-medium sf-font-mono sf-cursor-pointer sf-outline-none sf-transition-all ${
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
        className='sf-flex sf-items-center sf-gap-2 sf-px-2 sf-py-1 sf-text-xs'
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
        <div className='sf-flex sf-items-center sf-gap-1'>
          {autoSaveError && (
            <Button
              variant='secondary'
              isSmall
              onClick={onRetryAutosave}
              className='sf-h-7'>
              {__('Retry autosave', 'subtleforms')}
            </Button>
          )}
          {saveError && (
            <Button
              variant='secondary'
              isSmall
              onClick={onRetryLastManualSave}
              className='sf-h-7'>
              {__('Retry save', 'subtleforms')}
            </Button>
          )}
          <Button
            variant='tertiary'
            isSmall
            onClick={onDismissErrors}
            className='sf-h-7'>
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
      <div className='sf-flex sf-items-center sf-gap-2'>
        <Button
          variant='tertiary'
          onClick={() => dispatch({ type: BUILDER_ACTIONS.UNDO_SCHEMA })}
          disabled={!canUndo || saving || autoSaving}
          className='sf-px-3 sf-h-9 sf-font-medium sf-text-sm'
          title={__('Undo (Ctrl/Cmd+Z)', 'subtleforms')}>
          <Icon.Undo className='sf-fill-none sf-mr-2 sf-w-4 sf-h-4' />
        </Button>

        <Button
          variant='tertiary'
          onClick={() => dispatch({ type: BUILDER_ACTIONS.REDO_SCHEMA })}
          disabled={!canRedo || saving || autoSaving}
          className='sf-px-3 sf-h-9 sf-font-medium sf-text-sm'
          title={__('Redo (Shift+Ctrl/Cmd+Z)', 'subtleforms')}>
          <Icon.Redo className='sf-fill-none sf-mr-2 sf-w-4 sf-h-4' />
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
          className='sf-px-4 sf-h-9 sf-font-medium sf-text-sm'>
          {__('Preview', 'subtleforms')}
        </Button>

        {isDirty && (
          <Button
            variant='secondary'
            onClick={onSaveDraft}
            disabled={saving || autoSaving}
            className='sf-px-4 sf-h-9 sf-font-medium sf-text-sm'>
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
          className='sf-px-4 sf-h-9 sf-font-medium sf-text-sm'>
          {formStatus === 'published'
            ? __('Update', 'subtleforms')
            : __('Publish', 'subtleforms')}
        </Button>

        <Button
          variant='secondary'
          onClick={onSaveAndClose}
          disabled={saving || autoSaving}
          className='sf-px-4 sf-h-9 sf-font-medium sf-text-sm'
          title={__('Save changes and return to forms list', 'subtleforms')}>
          {__('Save & Close', 'subtleforms')}
        </Button>

        <Button
          variant='secondary'
          onClick={onDelete}
          isDestructive
          className='sf-px-4 sf-h-9 sf-font-medium sf-text-sm'
          title={__('Delete this form permanently', 'subtleforms')}>
          {__('Delete', 'subtleforms')}
        </Button>
      </div>
    </div>
  );
}
