import { __ } from '@wordpress/i18n';
import Icon from '../ui/Icon';
import { getIcon } from './utils/iconMap';

export default function ContainerRenderer({
  node,
  columns,
  isSelected,
  onSelect,
  onDelete,
  renderColumn,
  spacing,
  dragHandleRef,
  dragHandleListeners,
}) {
  const isColumnLayout = columns.length > 1;
  const isStep = node.type === 'step';
  const title = isStep
    ? node.config?.title || __('Step', 'subtleforms')
    : node.config?.label || __('Container', 'subtleforms');
  const gap = parseInt(spacing, 10) || 16;

  const { onPointerDown, onMouseDown, onTouchStart, ...handleRest } =
    dragHandleListeners || {};

  const handlePointerDown = (event) => {
    event.stopPropagation();
    if (typeof onPointerDown === 'function') {
      onPointerDown(event);
    }
  };

  const handleMouseDown = (event) => {
    event.stopPropagation();
    if (typeof onMouseDown === 'function') {
      onMouseDown(event);
    }
  };

  const handleTouchStart = (event) => {
    event.stopPropagation();
    if (typeof onTouchStart === 'function') {
      onTouchStart(event);
    }
  };

  return (
    <div
      tabIndex={0}
      role='button'
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          onSelect();
        }
      }}
      style={{
        border: isSelected ? '2px solid #2271b1' : '1px solid #dcdcde',
        borderRadius: '8px',
        background: isStep ? '#f9fafb' : '#fff',
        marginBottom: '18px',
        boxShadow: isSelected ? '0 4px 14px rgba(0,0,0,0.1)' : 'none',
      }}>
      <div
        style={{
          padding: '12px 16px',
          background: isStep ? '#e8eef5' : '#f0f0f1',
          borderBottom: '1px solid #dcdcde',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {dragHandleRef && !isStep && (
            <button
              type='button'
              ref={dragHandleRef}
              {...handleRest}
              onPointerDown={handlePointerDown}
              onMouseDown={handleMouseDown}
              onTouchStart={handleTouchStart}
              onClick={(event) => event.stopPropagation()}
              aria-label={__('Drag container', 'subtleforms')}
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '4px',
                border: '1px solid transparent',
                background: 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'grab',
                color: '#111827',
              }}>
              <Icon.Move size={16} />
            </button>
          )}
          {(() => {
            const NodeIcon = getIcon(node.type);
            return <NodeIcon size={20} />;
          })()}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <strong style={{ fontSize: '13px' }}>{title}</strong>
            {isStep && node.config?.description && (
              <span
                style={{
                  fontSize: '11px',
                  color: '#6b7280',
                  marginTop: '2px',
                }}>
                {node.config.description}
              </span>
            )}
          </div>
        </div>
        {!isStep && (
          <button
            type='button'
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            style={{
              border: 'none',
              background: 'transparent',
              color: '#d63638',
              cursor: 'pointer',
              fontWeight: 600,
            }}>
            ×
          </button>
        )}
      </div>

      <div
        style={{
          padding: '16px',
          background: isStep ? '#fafbfc' : '#fafafa',
        }}>
        <div
          style={{
            display: isColumnLayout ? 'grid' : 'block',
            gap: isColumnLayout ? `${gap}px` : undefined,
            gridTemplateColumns: isColumnLayout
              ? `repeat(${columns.length}, minmax(0, 1fr))`
              : undefined,
          }}>
          {columns.map((columnItems, index) => (
            <div key={`${node.id}-col-${index}`}>
              {renderColumn(columnItems, index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
