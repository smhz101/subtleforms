/**
 * BuilderHeaderBar Components
 *
 * Pure UI components for the builder page header with title editing and actions.
 * Split into two components to avoid React hooks violations:
 * - BuilderTitle: Editable title with form type badge
 * - BuilderActions: All action buttons and status indicators
 */

import { useRef } from '@wordpress/element';
import { Button, DropdownMenu, MenuGroup, MenuItem } from '@wordpress/components';
import { moreVertical } from '@wordpress/icons';
import { __ } from '@wordpress/i18n';
import Icon from '../../../ui/Icon';
import HelpMenu from '../../HelpMenu';
import LicenseStatusIndicator from '../../LicenseStatusIndicator';
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
          aria-label={__('Form title', 'subtleforms')}
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
        className={`sf-builder-header-bar__form-type-badge sf-builder-header-bar__form-type-badge--${formTypeBadge.color}`}
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
  onSaveDraft,
  onPublish,
  onUnpublish,
  onSaveAndClose,
  onDelete,
  onStartTour,
  onOpenWizard,
  showWizard,
}) {
  const isPublished = formStatus === 'published';
  const busy = saving || autoSaving;
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
              ? 'sf-builder-header-bar__shortcode-button--copied'
              : ''
          }`}
          title={
            copyState === 'copied'
              ? __('Copied to clipboard!', 'subtleforms')
              : __('Click to copy shortcode', 'subtleforms')
          }>
          {copyState === 'copied' ? (
            <>
              <Icon.Check size={14} />
              {__('Copied!', 'subtleforms')}
            </>
          ) : (
            shortcode
          )}
        </button>
      )}

      {/* Save Status Indicator */}
      <div
        className={`sf-builder-header-bar__save-status${
          effectiveStatus === 'error' ? ' is-error' : ''
        }`}
        role='status'
        title={statusDescription || undefined}>
        <span
          aria-hidden='true'
          className={`sf-builder-header-bar__save-dot sf-builder-header-bar__save-dot--${
            autoSaving ? 'saving' : effectiveStatus
          }`}
        />
        <span>{statusLabel}</span>
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

      <div className='sf-builder-header-bar__divider' aria-hidden='true' />

      {/* Primary Actions Group */}
      <div className='sf-builder-header-bar__action-buttons'>
        <LicenseStatusIndicator variant="inline" showDescription={false} />
        
        <Button
          variant='tertiary'
          onClick={() => dispatch({ type: BUILDER_ACTIONS.UNDO_SCHEMA })}
          disabled={!canUndo || busy}
          className='sf-builder-header-bar__undo-button'
          title={__('Undo (Ctrl/Cmd+Z)', 'subtleforms')}>
          <Icon.Undo className='sf-builder-header-bar__undo-icon' />
        </Button>

        <Button
          variant='tertiary'
          onClick={() => dispatch({ type: BUILDER_ACTIONS.REDO_SCHEMA })}
          disabled={!canRedo || busy}
          className='sf-builder-header-bar__redo-button'
          title={__('Redo (Shift+Ctrl/Cmd+Z)', 'subtleforms')}>
          <Icon.Redo className='sf-builder-header-bar__redo-icon' />
        </Button>

        <HelpMenu
          onStartTour={onStartTour}
          onOpenWizard={onOpenWizard}
          showWizard={showWizard}
        />

        {/* One action with an outcome autosave cannot produce: making the
            current draft the version visitors see. Everything else — saving,
            closing — either happens on its own or costs nothing, so it does not
            compete for the primary slot. */}
        <Button
          variant='primary'
          data-tour='publish-button'
          onClick={onPublish}
          disabled={busy || hasValidationErrors}
          className='sf-builder-header-bar__save-button'>
          {isPublished
            ? __('Update', 'subtleforms')
            : __('Publish', 'subtleforms')}
        </Button>

        <Button
          variant='tertiary'
          onClick={onSaveAndClose}
          disabled={busy}
          className='sf-builder-header-bar__close-button'
          title={__('Return to the forms list', 'subtleforms')}>
          {__('Close', 'subtleforms')}
        </Button>

        <DropdownMenu
          icon={moreVertical}
          label={__('More actions', 'subtleforms')}
          className='sf-builder-header-bar__more-menu'
          popoverProps={{ placement: 'bottom-end' }}>
          {({ onClose }) => (
            <>
              <MenuGroup>
                <MenuItem
                  disabled={!isDirty || busy}
                  info={__(
                    'Drafts also save on their own a few seconds after each change.',
                    'subtleforms'
                  )}
                  onClick={() => {
                    onSaveDraft();
                    onClose();
                  }}>
                  {__('Save draft now', 'subtleforms')}
                </MenuItem>
              </MenuGroup>

              {isPublished && (
                <MenuGroup>
                  <MenuItem
                    disabled={busy}
                    info={__(
                      'Takes the form off your site. The draft and its history are kept.',
                      'subtleforms'
                    )}
                    onClick={() => {
                      onUnpublish?.();
                      onClose();
                    }}>
                    {__('Unpublish', 'subtleforms')}
                  </MenuItem>
                </MenuGroup>
              )}

              <MenuGroup>
                <MenuItem
                  isDestructive
                  onClick={() => {
                    onDelete();
                    onClose();
                  }}>
                  {__('Delete form', 'subtleforms')}
                </MenuItem>
              </MenuGroup>
            </>
          )}
        </DropdownMenu>
      </div>
    </div>
  );
}
