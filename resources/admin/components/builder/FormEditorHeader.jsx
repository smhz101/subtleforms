import { useState, useRef, useEffect } from '@wordpress/element';
import { Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import Icon from '../ui/Icon';
import './FormEditorHeader.scss';

export default function FormEditorHeader({
  formTitle,
  formId,
  onTitleChange,
  status,
  onSave,
  onClose,
  saving,
  autoSaving,
}) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(formTitle);
  const [copyState, setCopyState] = useState('idle');
  const titleInputRef = useRef(null);
  const copyTimeoutRef = useRef(null);

  useEffect(() => {
    setTempTitle(formTitle);
  }, [formTitle]);

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  useEffect(
    () => () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    },
    []
  );

  const handleTitleClick = () => {
    if (!isEditingTitle) {
      setIsEditingTitle(true);
    }
  };

  const handleTitleBlur = () => {
    setIsEditingTitle(false);
    if (tempTitle.trim() && tempTitle !== formTitle) {
      onTitleChange(tempTitle.trim());
    } else {
      setTempTitle(formTitle);
    }
  };

  const handleTitleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      titleInputRef.current?.blur();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setTempTitle(formTitle);
      setIsEditingTitle(false);
    }
  };

  const handleCopyShortcode = async () => {
    if (!formId) return;
    const shortcode = `[subtleforms id="${formId}"]`;
    try {
      await navigator.clipboard.writeText(shortcode);
      setCopyState('copied');
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = setTimeout(() => {
        setCopyState('idle');
      }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      setCopyState('error');
    }
  };

  const getStatusText = () => {
    if (autoSaving) return __('Saving...', 'subtleforms');
    if (status === 'dirty') return __('Unsaved changes', 'subtleforms');
    return __('All changes saved', 'subtleforms');
  };

  const getStatusColor = () => {
    if (autoSaving) return '#2271b1';
    if (status === 'dirty') return '#f0b849';
    return '#00a32a';
  };

  return (
    <div className='sf-form-editor-header'>
      {/* Left Section */}
      <div className='sf-form-editor-header__left'>
        {/* Logo/Icon */}
        <div className='sf-form-editor-header__logo'>
          SF
        </div>

        {/* Editable Title */}
        {isEditingTitle ? (
          <input
            ref={titleInputRef}
            type='text'
            value={tempTitle}
            onChange={(e) => setTempTitle(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={handleTitleKeyDown}
            className='sf-form-editor-header__title-input'
          />
        ) : (
          <button
            type='button'
            onClick={handleTitleClick}
            className='sf-form-editor-header__title-button'
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#2271b1';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#1e1e1e';
            }}>
            {formTitle || __('Untitled Form', 'subtleforms')}
          </button>
        )}

        {/* Shortcode Pill */}
        {formId && (
          <button
            type='button'
            onClick={handleCopyShortcode}
            disabled={!formId}
            className={copyState === 'copied'
              ? 'sf-form-editor-header__shortcode sf-form-editor-header__shortcode--copied'
              : 'sf-form-editor-header__shortcode'}
            onMouseEnter={(e) => {
              if (formId && copyState !== 'copied') {
                e.currentTarget.style.borderColor = '#2271b1';
              }
            }}
            onMouseLeave={(e) => {
              if (copyState !== 'copied') {
                e.currentTarget.style.borderColor = '#dcdcde';
              }
            }}>
            {copyState === 'copied' ? (
              <>
                <Icon.Check size={14} />
                {__('Copied!', 'subtleforms')}
              </>
            ) : (
              `[subtleforms id="${formId || '...'}"]`
            )}
          </button>
        )}
      </div>

      {/* Right Section */}
      <div className='sf-form-editor-header__right'>
        {/* Save Status */}
        <div className='sf-form-editor-header__status'>
          <span
            className='sf-form-editor-header__status-dot'
            style={{ background: getStatusColor() }}
          />
          {getStatusText()}
        </div>

        {/* Manual Save Button */}
        {status === 'dirty' && (
          <Button
            variant='primary'
            onClick={onSave}
            disabled={saving}
            className='sf-form-editor-header__save-btn'>
            {saving
              ? __('Saving...', 'subtleforms')
              : __('Save', 'subtleforms')}
          </Button>
        )}

        {/* Close Button */}
        <Button
          icon={close}
          label={__('Close Editor', 'subtleforms')}
          onClick={onClose}
          className='sf-form-editor-header__close-btn'
        />
      </div>
    </div>
  );
}
