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
import { chevronDown } from '@wordpress/icons';
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

        {/* Publishing is the one outcome autosave cannot produce: it makes the
            current draft the version visitors see. Its opposite — returning the
            form to a draft — is the same axis, so it hangs off the same control
            rather than sitting in a generic menu next to Delete. */}
        <div className='sf-builder-header-bar__publish-group'>
          <Button
            variant='primary'
            data-tour='publish-button'
            onClick={onPublish}
            disabled={busy || hasValidationErrors}
            className='sf-builder-header-bar__publish-button'>
            {saving && (
              <Icon.Spinner
                size={14}
                className='sf-spin sf-builder-header-bar__publish-spinner'
                aria-hidden='true'
              />
            )}
            {saving
              ? __('Saving…', 'subtleforms')
              : isPublished
              ? __('Update', 'subtleforms')
              : __('Publish', 'subtleforms')}
          </Button>

          <DropdownMenu
            icon={chevronDown}
            /* Validation blocks publishing, not the menu: switching to draft
               and deleting are exactly what you need on a form that cannot
               publish, so the arrow only follows `busy`. */
            label={
              isPublished
                ? __('Update options', 'subtleforms')
                : __('Publish options', 'subtleforms')
            }
            className='sf-builder-header-bar__publish-menu'
            toggleProps={{
              variant: 'primary',
              disabled: busy,
              className: 'sf-builder-header-bar__publish-arrow',
            }}
            popoverProps={{ placement: 'bottom-end' }}>
            {({ onClose }) => (
              <>
                <MenuGroup label={__('Status', 'subtleforms')}>
                  {isPublished ? (
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
                      {__('Switch to draft', 'subtleforms')}
                    </MenuItem>
                  ) : (
                    <MenuItem
                      disabled={busy || hasValidationErrors}
                      info={
                        hasValidationErrors
                          ? __(
                              'Fix the validation issues above first.',
                              'subtleforms'
                            )
                          : __(
                              'Makes this form visible on your site.',
                              'subtleforms'
                            )
                      }
                      onClick={() => {
                        onPublish();
                        onClose();
                      }}>
                      {__('Publish', 'subtleforms')}
                    </MenuItem>
                  )}
                </MenuGroup>

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

        <Button
          variant='tertiary'
          onClick={onSaveAndClose}
          disabled={busy}
          className='sf-builder-header-bar__close-button'
          title={__('Return to the forms list', 'subtleforms')}>
          {__('Close', 'subtleforms')}
        </Button>
      </div>
    </div>
  );
}
