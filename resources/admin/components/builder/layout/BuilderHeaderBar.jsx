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
import { __, sprintf } from '@wordpress/i18n';
import Icon from '../../../ui/Icon';
import HelpMenu from '../../HelpMenu';
import { BUILDER_ACTIONS } from '../../../hooks/useBuilderReducer';
import {
  getFormStatusBadgeConfig,
  FORM_STATUS_PUBLISHED,
} from '../../../utils/formMeta';
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
          title={__('Rename form', 'subtleforms')}>
          {formTitle || __('Untitled Form', 'subtleforms')}
        </button>
      )}

      {/** form type */}
      <span
        className={`sf-builder-header-bar__form-type-badge sf-builder-header-bar__form-type-badge--${formTypeBadge.color}`}
        title={formTypeBadge.label}>
        <FormTypeIcon className='sf-builder-header-bar__form-type-icon' />
        <span className='sf-builder-header-bar__form-type-label'>{formTypeBadge.label}</span>
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
  hasUnpublishedChanges,
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
  onDiscardChanges,
  onSaveAndClose,
  onDelete,
  onStartTour,
  onOpenWizard,
  showWizard,
}) {
  const isPublished = formStatus === FORM_STATUS_PUBLISHED;
  // A published form with unsaved/unpublished draft edits shows
  // "Published · changes not live" instead of "Draft", using the same status
  // helper as the All Forms and Dashboard listings, one source of truth
  // (Part A5).
  const showUnpublishedChanges = isPublished && (hasUnpublishedChanges || isDirty);
  const statusBadge = getFormStatusBadgeConfig(
    isPublished ? FORM_STATUS_PUBLISHED : 'draft',
    showUnpublishedChanges
  );
  const busy = saving || autoSaving;
  const statusBadgeClass = showUnpublishedChanges
    ? 'sf-builder-header-bar__mode-badge--unpublished'
    : isPublished
      ? 'sf-builder-header-bar__mode-badge--published'
      : 'sf-builder-header-bar__mode-badge--draft';
  const statusBadgeLabel = statusBadge.label;
  const statusBadgeTitle = showUnpublishedChanges
    ? __('Form is live, but has unpublished draft changes', 'subtleforms')
    : isPublished
      ? __('Form is live and visible to users', 'subtleforms')
      : __('Form is saved but not published', 'subtleforms');

  return (
    <div className='sf-builder-header-bar__center'>
      {/* Status Badge, single source of truth (shared with listings) */}
      <span
        data-tour='status-badge'
        className={`sf-builder-header-bar__mode-badge ${statusBadgeClass}`}
        title={statusBadgeTitle}>
        <span className='sf-builder-header-bar__mode-dot' aria-hidden='true' />
        <span className='sf-builder-header-bar__mode-label'>{statusBadgeLabel}</span>
      </span>

      {/* Shortcode, compact copy button; the full shortcode is in the tooltip */}
      {shortcode && (
        <Button
          size='compact'
          onClick={() => onCopyShortcode(shortcode)}
          className={`sf-builder-header-bar__shortcode-button${
            copyState === 'copied' ? ' sf-builder-header-bar__shortcode-button--copied' : ''
          }`}
          icon={copyState === 'copied' ? <Icon.Check size={16} /> : <Icon.Code size={16} />}
          label={
            copyState === 'copied'
              ? __('Shortcode copied', 'subtleforms')
              : sprintf(
                  /* translators: %s: form shortcode */
                  __('Copy shortcode %s', 'subtleforms'),
                  shortcode
                )
          }
          showTooltip
        />
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
        <span className='sf-builder-header-bar__save-label'>{statusLabel}</span>
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
              {__('Retry', 'subtleforms')}
            </Button>
          )}
          {saveError && (
            <Button
              variant='secondary'
              isSmall
              onClick={onRetryLastManualSave}
              className='sf-builder-header-bar__tour-button'>
              {__('Retry', 'subtleforms')}
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
        <Button
          variant='tertiary'
          onClick={() => dispatch({ type: BUILDER_ACTIONS.UNDO_SCHEMA })}
          disabled={!canUndo || busy}
          accessibleWhenDisabled
          className='sf-builder-header-bar__icon-button sf-builder-header-bar__undo-button'
          label={__('Undo', 'subtleforms')}
          shortcut={__('Ctrl/Cmd+Z', 'subtleforms')}
          showTooltip
          icon={<Icon.Undo size={18} className='sf-builder-header-bar__undo-icon' />}
        />

        <Button
          variant='tertiary'
          onClick={() => dispatch({ type: BUILDER_ACTIONS.REDO_SCHEMA })}
          disabled={!canRedo || busy}
          accessibleWhenDisabled
          className='sf-builder-header-bar__icon-button sf-builder-header-bar__redo-button'
          label={__('Redo', 'subtleforms')}
          shortcut={__('Shift+Ctrl/Cmd+Z', 'subtleforms')}
          showTooltip
          icon={<Icon.Redo size={18} className='sf-builder-header-bar__redo-icon' />}
        />

        <HelpMenu
          onStartTour={onStartTour}
          onOpenWizard={onOpenWizard}
          showWizard={showWizard}
        />

        {/* Publishing is the one outcome autosave cannot produce: it makes the
            current draft the version visitors see. Its opposite, returning the
            form to a draft, is the same axis, so it hangs off the same control
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
                  {/* Publish, always available (disabled when already live,
                      blocked by validation, or busy). The split-button's main
                      action is the common path; this covers the rest. */}
                  <MenuItem
                    disabled={isPublished || busy || hasValidationErrors}
                    info={
                      hasValidationErrors
                        ? __(
                            'Fix the validation issues above first.',
                            'subtleforms'
                          )
                        : isPublished
                          ? __(
                              'This form is already live. Use Update to republish changes.',
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

                  {/* Save draft now */}
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
                    {__('Save draft', 'subtleforms')}
                  </MenuItem>

                  {/* Unpublish, takes a live form off the site (keeps draft) */}
                  <MenuItem
                    disabled={!isPublished || busy}
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

                  {/* Discard changes, revert local draft to the last
                      persisted version without leaving the builder. */}
                  <MenuItem
                    disabled={!isDirty || busy}
                    info={__(
                      'Reverts unsaved edits to the last saved or published version.',
                      'subtleforms'
                    )}
                    onClick={() => {
                      onDiscardChanges?.();
                      onClose();
                    }}>
                    {__('Discard changes', 'subtleforms')}
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

      </div>
    </div>
  );
}
