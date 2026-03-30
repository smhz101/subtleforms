import { memo } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import Icon from '../ui/Icon';
import { getIcon } from './utils/iconMap';

/**
 * GroupRenderer — Chrome wrapper for group field nodes (name_group, address_group).
 *
 * Renders a titled container that holds fixed child fields. The group node itself is
 * drag-sortable in the form canvas (handled by SortableWrapper in FormBuilder). Children
 * are rendered via recursive renderNode calls passed as React children.
 */
const GroupRenderer = memo( function GroupRenderer( {
  node,
  field,
  isSelected,
  onSelect,
  onDelete,
  dragHandleRef,
  dragHandleListeners,
  children,
} ) {
  const label = field?.label || __( 'Group', 'subtleforms' );
  const NodeIcon = getIcon( node?.type );

  const { onPointerDown, onMouseDown, onTouchStart, ...handleRest } =
    dragHandleListeners || {};

  const handlePointerDown = ( event ) => {
    event.stopPropagation();
    if ( typeof onPointerDown === 'function' ) onPointerDown( event );
  };

  const handleMouseDown = ( event ) => {
    event.stopPropagation();
    if ( typeof onMouseDown === 'function' ) onMouseDown( event );
  };

  const handleTouchStart = ( event ) => {
    event.stopPropagation();
    if ( typeof onTouchStart === 'function' ) onTouchStart( event );
  };

  return (
    <div
      tabIndex={ 0 }
      role='button'
      onClick={ ( e ) => {
        e.stopPropagation();
        onSelect();
      } }
      onKeyDown={ ( e ) => {
        if ( e.key === 'Enter' || e.key === ' ' ) {
          e.preventDefault();
          e.stopPropagation();
          onSelect();
        }
      } }
      style={ {
        border: isSelected ? '2px solid #2271b1' : '1px solid #dcdcde',
        borderRadius: '8px',
        background: '#fff',
        marginBottom: '18px',
        boxShadow: isSelected ? '0 4px 14px rgba(0,0,0,0.1)' : 'none',
      } }>
      {/* Header bar */}
      <div
        style={ {
          padding: '12px 16px',
          background: '#f0f0f1',
          borderBottom: '1px solid #dcdcde',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        } }>
        <div style={ { display: 'flex', alignItems: 'center', gap: '10px' } }>
          { dragHandleRef && (
            <button
              type='button'
              ref={ dragHandleRef }
              { ...handleRest }
              onPointerDown={ handlePointerDown }
              onMouseDown={ handleMouseDown }
              onTouchStart={ handleTouchStart }
              onClick={ ( e ) => e.stopPropagation() }
              aria-label={ __( 'Drag group', 'subtleforms' ) }
              style={ {
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
              } }>
              <Icon.Move size={ 16 } />
            </button>
          ) }
          { NodeIcon && <NodeIcon size={ 20 } /> }
          <strong style={ { fontSize: '13px' } }>{ label }</strong>
        </div>
        <button
          type='button'
          onClick={ ( e ) => {
            e.stopPropagation();
            onDelete();
          } }
          style={ {
            border: 'none',
            background: 'transparent',
            color: '#d63638',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '18px',
            lineHeight: 1,
          } }>
          ×
        </button>
      </div>
      {/* Children */}
      <div style={ { padding: '16px' } }>
        { children }
      </div>
    </div>
  );
} );

export default GroupRenderer;
