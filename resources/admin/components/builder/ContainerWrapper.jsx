import { __ } from '@wordpress/i18n';
import Icon from '../ui/Icon';
import clsx from 'clsx';
import { getIcon } from './utils/iconMap';
import './ContainerWrapper.scss';

export default function ContainerWrapper({
  field,
  path,
  isSelected,
  isHovered: _isHovered,
  onSelect,
  onHover,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onDelete,
  children,
}) {
  const isRepeat = field.type === 'repeat_container';
  const columns = field.columns || 1;

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onSelect(path);
      }}
      onMouseEnter={(e) => {
        e.stopPropagation();
        onHover(path);
      }}
      onMouseLeave={() => onHover(null)}
      className={clsx('sf-container-wrapper', {
        'sf-container-wrapper--selected': isSelected,
        'sf-container-wrapper--default': !isSelected,
      })}>
      {/* Header */}
      <div className='sf-container-wrapper__header'>
        <div className='sf-container-wrapper__header-title'>
          {(() => {
            const ContainerIcon = getIcon(field.type);
            return <ContainerIcon size={20} />;
          })()}
          <span className='sf-container-wrapper__header-label'>
            {field.label ||
              (isRepeat
                ? __('Repeat Container', 'subtleforms')
                : __(`${columns} Columns`, 'subtleforms'))}
          </span>
        </div>

        {/* Actions */}
        {isSelected && (
          <div className='sf-container-wrapper__actions'>
            <button
              onClick={() => onMoveUp(path)}
              className='sf-container-wrapper__action-button'
              title={__('Move Up', 'subtleforms')}>
              <Icon.Up className='sf-container-wrapper__icon' />
            </button>
            <button
              onClick={() => onMoveDown(path)}
              className='sf-container-wrapper__action-button'
              title={__('Move Down', 'subtleforms')}>
              <Icon.Down className='sf-container-wrapper__icon' />
            </button>
            <button
              onClick={() => onDuplicate(path)}
              className='sf-container-wrapper__action-button'
              title={__('Duplicate', 'subtleforms')}>
              <Icon.Copy className='sf-container-wrapper__icon' />
            </button>
            <button
              onClick={() => onDelete(path)}
              className='sf-container-wrapper__action-button sf-container-wrapper__action-button--danger'
              title={__('Delete', 'subtleforms')}>
              <Icon.Delete className='sf-container-wrapper__icon' />
            </button>
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className='sf-container-wrapper__content'>{children}</div>

      {isRepeat && (
        <div className='sf-container-wrapper__repeat-note'>
          {__('Repeatable items will appear here', 'subtleforms')}
        </div>
      )}
    </div>
  );
}
