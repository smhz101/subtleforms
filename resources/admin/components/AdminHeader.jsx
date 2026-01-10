import { memo, useState, useRef, useEffect } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import Icon from './ui/Icon';

/**
 * AdminHeader - Sticky Header Component
 *
 * Single reusable header for all SubtleForms admin pages.
 *
 * Features:
 * - Fixed height (60px) across all pages
 * - Flat design (no shadow, no rounded corners)
 * - Never scrolls away (sticky positioning)
 * - Context-aware action buttons
 * - Editable title support
 * - Memoized to prevent unnecessary re-renders
 *
 * @param {Object} props
 * @param {string|React.ReactNode} props.title - Page title (string or React element)
 * @param {React.ReactNode} props.actions - Action buttons (context-aware per page)
 * @param {boolean} props.editableTitle - Whether title should be editable (default: false)
 * @param {Function} props.onTitleChange - Callback when title is changed (required if editableTitle=true)
 */
const AdminHeader = memo(function AdminHeader({
  title,
  actions,
  editableTitle = false,
  onTitleChange,
}) {
  const HEADER_HEIGHT = 60;
  const WP_ADMIN_BAR_HEIGHT = 32;

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState('');
  const titleInputRef = useRef(null);

  // Initialize title value for editable mode
  useEffect(() => {
    if (editableTitle && typeof title === 'string') {
      setTitleValue(title);
    }
  }, [title, editableTitle]);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  const handleTitleSave = () => {
    if (onTitleChange && titleValue.trim()) {
      onTitleChange(titleValue.trim());
    }
    setIsEditingTitle(false);
  };

  const handleTitleCancel = () => {
    setTitleValue(typeof title === 'string' ? title : '');
    setIsEditingTitle(false);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleTitleSave();
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      handleTitleCancel();
    }
  };

  // Render title element based on type and editable state
  const renderTitle = () => {
    // If title is a React element, render it directly
    if (typeof title !== 'string') {
      return title;
    }

    // If not editable, render as static text
    if (!editableTitle) {
      return (
        <h1 className='sf-m-0 sf-font-semibold sf-text-gray-900 sf-text-lg sf-leading-none'>
          {title}
        </h1>
      );
    }

    // Editable title mode
    if (isEditingTitle) {
      return (
        <input
          ref={titleInputRef}
          type='text'
          value={titleValue}
          onChange={(event) => setTitleValue(event.target.value)}
          onBlur={handleTitleSave}
          onKeyDown={handleKeyDown}
          className='sf-bg-white sf-px-2 sf-py-1 sf-border sf-border-blue-600 sf-outline-none sf-min-w-[200px] sf-font-semibold sf-text-gray-900 sf-text-lg sf-leading-none'
          placeholder={__('Enter title...', 'subtleforms')}
        />
      );
    }

    return (
      <button
        type='button'
        onClick={() => setIsEditingTitle(true)}
        className='sf-bg-transparent sf-px-2 sf-py-1 sf-border-none sf-outline-none sf-font-semibold sf-text-gray-900 hover:sf-text-blue-600 sf-text-lg sf-leading-none sf-transition-colors sf-cursor-pointer'
        title={__('Click to edit title', 'subtleforms')}>
        {title || __('Untitled', 'subtleforms')}
      </button>
    );
  };

  return (
    <div
      className='sf-flex sf-flex-shrink-0 sf-justify-between sf-items-center sf-bg-blue-200 sf-px-6 sf-border-gray-300 sf-border-b'
      style={{
        height: `${HEADER_HEIGHT}px`,
        position: 'sticky',
        // top: `${WP_ADMIN_BAR_HEIGHT}px`,
        zIndex: 100,
      }}>
      {/* Left Side: Logo + Title */}
      <div className='sf-flex sf-items-center sf-gap-4'>
        <div className='sf-flex sf-items-center sf-gap-3'>
          {/* SubtleForms Logo */}

          <div
            className='sf-inline-flex sf-justify-center sf-items-center sf-bg-white sf-shadow-sm sf-border sf-border-gray-200 sf-rounded-md sf-w-8 sf-h-8 sf-font-semibold sf-text-gray-800 sf-text-xs'
            aria-label={__('SubtleForms', 'subtleforms')}
            title={__('SubtleForms', 'subtleforms')}>
            SF
          </div>

          {renderTitle()}
        </div>
      </div>

      {/* Right Side: Action Buttons (Context-Aware) */}
      {actions && (
        <div className='sf-flex sf-items-center sf-gap-2'>{actions}</div>
      )}
    </div>
  );
});

export default AdminHeader;
