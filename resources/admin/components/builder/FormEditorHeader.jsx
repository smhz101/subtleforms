import { useState, useRef, useEffect } from '@wordpress/element';
import { Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { FiCheck } from 'react-icons/fi';

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
    <div className='sf-top-0 sf-z-[100] sf-sticky sf-flex sf-justify-between sf-items-center sf-bg-white sf-px-6 sf-border-gray-300 sf-border-b sf-h-[60px]'>
      {/* Left Section */}
      <div className='sf-flex sf-items-center sf-gap-4'>
        {/* Logo/Icon */}
        <div className='sf-flex sf-justify-center sf-items-center sf-bg-blue-600 sf-w-8 sf-h-8 sf-font-bold sf-text-white sf-text-base'>
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
            className='sf-bg-white sf-px-2 sf-py-1 sf-border sf-border-blue-600 sf-outline-none sf-min-w-[200px] sf-font-semibold sf-text-gray-900 sf-text-base'
          />
        ) : (
          <button
            type='button'
            onClick={handleTitleClick}
            className='sf-bg-transparent sf-px-2 sf-py-1 sf-border-none sf-outline-none sf-font-semibold sf-text-gray-900 hover:text-blue-600 sf-text-base sf-cursor-pointer'
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
            className={`sf-inline-flex sf-items-center sf-gap-1.5 sf-px-3 sf-py-1 sf-text-xs sf-font-medium sf-font-mono sf-outline-none ${
              copyState === 'copied'
                ? 'sf-text-green-600 sf-bg-blue-50 sf-border sf-border-green-600'
                : 'sf-text-gray-700 sf-bg-gray-100 sf-border sf-border-gray-300'
            } ${formId ? 'sf-cursor-pointer' : 'sf-cursor-not-allowed'}`}
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
                <FiCheck size={14} />
                {__('Copied!', 'subtleforms')}
              </>
            ) : (
              `[subtleforms id="${formId || '...'}"]`
            )}
          </button>
        )}
      </div>

      {/* Right Section */}
      <div className='sf-flex sf-items-center sf-gap-4'>
        {/* Save Status */}
        <div className='sf-flex sf-items-center sf-gap-1.5 sf-text-gray-700 sf-text-xs'>
          <span
            className='rounded-full sf-w-1.5 sf-h-1.5'
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
            className='sf-px-4 sf-h-9'>
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
          className='sf-border sf-border-gray-300 sf-w-9 sf-h-9'
        />
      </div>
    </div>
  );
}
