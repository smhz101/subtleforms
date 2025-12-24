import { useState, useRef, useEffect } from '@wordpress/element';
import { Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { Icon, check, close } from '@wordpress/icons';

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
    <div
      style={{
        height: '60px',
        borderBottom: '1px solid #ddd',
        background: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
      {/* Left Section */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {/* Logo/Icon */}
        <div
          style={{
            width: '32px',
            height: '32px',
            background: '#2271b1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: '16px',
            fontWeight: 700,
          }}>
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
            style={{
              fontSize: '16px',
              fontWeight: 600,
              color: '#1e1e1e',
              border: '1px solid #2271b1',
              padding: '4px 8px',
              outline: 'none',
              minWidth: '200px',
              background: '#fff',
            }}
          />
        ) : (
          <button
            type='button'
            onClick={handleTitleClick}
            style={{
              fontSize: '16px',
              fontWeight: 600,
              color: '#1e1e1e',
              border: 'none',
              background: 'transparent',
              padding: '4px 8px',
              cursor: 'pointer',
              outline: 'none',
            }}
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
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 12px',
              fontSize: '12px',
              fontWeight: 500,
              fontFamily: 'monospace',
              color: copyState === 'copied' ? '#00a32a' : '#50575e',
              background: copyState === 'copied' ? '#f0f6fc' : '#f6f7f7',
              border:
                copyState === 'copied'
                  ? '1px solid #00a32a'
                  : '1px solid #dcdcde',
              cursor: formId ? 'pointer' : 'not-allowed',
              outline: 'none',
            }}
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
                <Icon icon={check} size={14} />
                {__('Copied!', 'subtleforms')}
              </>
            ) : (
              `[subtleforms id="${formId || '...'}"]`
            )}
          </button>
        )}
      </div>

      {/* Right Section */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {/* Save Status */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '13px',
            color: '#50575e',
          }}>
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: getStatusColor(),
            }}
          />
          {getStatusText()}
        </div>

        {/* Manual Save Button */}
        {status === 'dirty' && (
          <Button
            variant='primary'
            onClick={onSave}
            disabled={saving}
            style={{
              borderRadius: 0,
              height: '36px',
              padding: '0 16px',
            }}>
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
          style={{
            borderRadius: 0,
            width: '36px',
            height: '36px',
            border: '1px solid #dcdcde',
          }}
        />
      </div>
    </div>
  );
}
