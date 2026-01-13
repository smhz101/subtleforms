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
      className={clsx('container-wrapper', {
        'container-wrapper--selected': isSelected,
        'container-wrapper--default': !isSelected,
      })}>
      {/* Header */}
      <div className='container-wrapper__header'>
        <div className='container-wrapper__header-title'>
          {(() => {
            const ContainerIcon = getIcon(field.type);
            return <ContainerIcon size={20} />;
          })()}
          <span className='container-wrapper__header-label'>
            {field.label ||
              (isRepeat
                ? __('Repeat Container', 'subtleforms')
                : __(`${columns} Columns`, 'subtleforms'))}
          </span>
        </div>

        {/* Actions */}
        {isSelected && (
          <div className='container-wrapper__actions'>
            <button
              onClick={() => onMoveUp(path)}
              className='container-wrapper__action-button'
              title={__('Move Up', 'subtleforms')}>
              <Icon.Up className='container-wrapper__icon' />
            </button>
            <button
              onClick={() => onMoveDown(path)}
              className='container-wrapper__action-button'
              title={__('Move Down', 'subtleforms')}>
              <Icon.Down className='container-wrapper__icon' />
            </button>
            <button
              onClick={() => onDuplicate(path)}
              className='container-wrapper__action-button'
              title={__('Duplicate', 'subtleforms')}>
              <Icon.Copy className='container-wrapper__icon' />
            </button>
            <button
              onClick={() => onDelete(path)}
              className='container-wrapper__action-button container-wrapper__action-button--danger'
              title={__('Delete', 'subtleforms')}>
              <Icon.Delete className='container-wrapper__icon' />
            </button>
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className='container-wrapper__content'>{children}</div>

      {isRepeat && (
        <div className='container-wrapper__repeat-note'>
          {__('Repeatable items will appear here', 'subtleforms')}
        </div>
      )}
    </div>
  );
}
