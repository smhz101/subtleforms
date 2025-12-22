import { __ } from '@wordpress/i18n';
import { Icon, Button } from '@wordpress/components';
import { getIcon } from './utils/iconMap';

export default function ContainerWrapper({
  field,
  path,
  isSelected,
  isHovered,
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
      style={{
        position: 'relative',
        marginBottom: '16px',
        border: isSelected ? '2px solid #2271b1' : '1px solid #e0e0e0',
        borderRadius: '4px',
        background: '#fff',
        transition: 'all 0.2s',
        boxShadow: isHovered ? '0 2px 8px rgba(0,0,0,0.05)' : 'none',
      }}>
      {/* Header */}
      <div
        style={{
          padding: '8px 12px',
          background: '#f0f0f1',
          borderBottom: '1px solid #e0e0e0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'move',
        }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Icon icon={getIcon(field.type)} size={20} />
          <span style={{ fontWeight: 600, fontSize: '13px' }}>
            {field.label ||
              (isRepeat
                ? __('Repeat Container', 'subtleforms')
                : __(`${columns} Columns`, 'subtleforms'))}
          </span>
        </div>

        {/* Actions */}
        {isSelected && (
          <div style={{ display: 'flex', gap: '4px' }}>
            <Button
              isSmall
              icon='arrow-up-alt2'
              onClick={() => onMoveUp(path)}
              label={__('Move Up', 'subtleforms')}
            />
            <Button
              isSmall
              icon='arrow-down-alt2'
              onClick={() => onMoveDown(path)}
              label={__('Move Down', 'subtleforms')}
            />
            <Button
              isSmall
              icon='admin-page'
              onClick={() => onDuplicate(path)}
              label={__('Duplicate', 'subtleforms')}
            />
            <Button
              isSmall
              icon='trash'
              isDestructive
              onClick={() => onDelete(path)}
              label={__('Delete', 'subtleforms')}
            />
          </div>
        )}
      </div>

      {/* Content Area */}
      <div style={{ padding: '16px', minHeight: '60px' }}>{children}</div>

      {isRepeat && (
        <div
          style={{
            padding: '8px 16px',
            borderTop: '1px dashed #e0e0e0',
            color: '#757575',
            fontSize: '12px',
            fontStyle: 'italic',
          }}>
          {__('Repeatable items will appear here', 'subtleforms')}
        </div>
      )}
    </div>
  );
}
