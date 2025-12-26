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
    <div className='top-0 z-[100] sticky flex justify-between items-center bg-white px-6 border-gray-300 border-b h-[60px]'>
      {/* Left Section */}
      <div className='flex items-center gap-4'>
        {/* Logo/Icon */}
        <div className='flex justify-center items-center bg-blue-600 w-8 h-8 font-bold text-white text-base'>
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
            className='bg-white px-2 py-1 border border-blue-600 outline-none min-w-[200px] font-semibold text-gray-900 text-base'
          />
        ) : (
          <button
            type='button'
            onClick={handleTitleClick}
            className='bg-transparent px-2 py-1 border-none outline-none font-semibold text-gray-900 hover:text-blue-600 text-base cursor-pointer'
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
            className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium font-mono outline-none ${
              copyState === 'copied'
                ? 'text-green-600 bg-blue-50 border border-green-600'
                : 'text-gray-700 bg-gray-100 border border-gray-300'
            } ${formId ? 'cursor-pointer' : 'cursor-not-allowed'}`}
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
      <div className='flex items-center gap-4'>
        {/* Save Status */}
        <div className='flex items-center gap-1.5 text-gray-700 text-xs'>
          <span
            className='rounded-full w-1.5 h-1.5'
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
            className='px-4 h-9'>
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
          className='border border-gray-300 w-9 h-9'
        />
      </div>
    </div>
  );
}
