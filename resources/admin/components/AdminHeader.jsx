import { memo, useState, useRef, useEffect } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { Tooltip } from '@wordpress/components';
import { useNavigate } from 'react-router-dom';
import Logo from '../ui/Logo';
import Icon from '../ui/Icon';
import AppNav from './AppNav';
import TopBarUtilities from './TopBarUtilities';
import './AdminHeader.scss';

/**
 * AdminHeader, the top bar of the SubtleForms frame.
 *
 * Two variants share one 56px bar so the frame never jumps between screens:
 *
 * - `app`    Brand, in-app navigation and global utilities (help, plan).
 *            Page titles and page actions live in the page header below it.
 * - `editor` A focused bar for the form builder: back to Forms, the editable
 *            title and the builder's own actions. No global navigation, the
 *            same way the block editor hides the admin chrome.
 *
 * @param {Object}               props
 * @param {'app'|'editor'}       props.variant
 * @param {string|React.ReactNode} props.title         Editor variant only.
 * @param {React.ReactNode}      props.actions          Editor variant only.
 * @param {boolean}              props.editableTitle    Editor variant only.
 * @param {Function}             props.onTitleChange    Editor variant only.
 * @param {string}               props.backTo           Route for the back button.
 */
const AdminHeader = memo(function AdminHeader({
  variant = 'app',
  title,
  actions,
  editableTitle = false,
  onTitleChange,
  backTo = '/forms',
  onBack,
  centerSlot,
}) {
  if (variant === 'editor') {
    return (
      <EditorBar
        title={title}
        actions={actions}
        centerSlot={centerSlot}
        editableTitle={editableTitle}
        onTitleChange={onTitleChange}
        backTo={backTo}
        onBack={onBack}
      />
    );
  }

  return (
    <header className='sf-topbar' role='banner'>
      <div className='sf-topbar__brand'>
        <Logo size={28} wordmark />
      </div>
      <AppNav />
      <div className='sf-topbar__end'>
        <TopBarUtilities />
      </div>
    </header>
  );
});

/**
 * Builder top bar.
 */
function EditorBar({ title, actions, centerSlot, editableTitle, onTitleChange, backTo, onBack }) {
  const navigate = useNavigate();

  return (
    <header className='sf-topbar sf-topbar--editor' role='banner'>
      <div className='sf-topbar__start'>
        <Tooltip text={__('Back to forms', 'subtleforms')}>
          <button
            type='button'
            className='sf-topbar__back'
            onClick={() => (onBack ? onBack() : navigate(backTo))}
            aria-label={__('Back to forms', 'subtleforms')}>
            <Logo size={32} />
            <span className='sf-topbar__back-arrow' aria-hidden='true'>
              <Icon.ArrowLeft size={18} />
            </span>
          </button>
        </Tooltip>
        <div className='sf-topbar__title'>
          <EditableTitle
            title={title}
            editableTitle={editableTitle}
            onTitleChange={onTitleChange}
          />
        </div>
      </div>
      {centerSlot && <div className='sf-topbar__center'>{centerSlot}</div>}
      {actions && <div className='sf-topbar__actions'>{actions}</div>}
    </header>
  );
}

/**
 * Title that can be a plain string, an editable string, or a custom element.
 */
function EditableTitle({ title, editableTitle, onTitleChange }) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (editableTitle && typeof title === 'string') {
      setValue(title);
    }
  }, [title, editableTitle]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  if (typeof title !== 'string') {
    return title || null;
  }

  if (!editableTitle) {
    return <h1 className='sf-topbar__heading'>{title}</h1>;
  }

  const save = () => {
    if (onTitleChange && value.trim()) {
      onTitleChange(value.trim());
    }
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type='text'
        aria-label={__('Form title', 'subtleforms')}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onBlur={save}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            save();
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            setValue(title);
            setIsEditing(false);
          }
        }}
        className='sf-topbar__title-input'
        placeholder={__('Enter title…', 'subtleforms')}
      />
    );
  }

  return (
    <button
      type='button'
      onClick={() => setIsEditing(true)}
      className='sf-topbar__title-button'
      title={__('Rename', 'subtleforms')}>
      {title || __('Untitled', 'subtleforms')}
    </button>
  );
}

export default AdminHeader;
