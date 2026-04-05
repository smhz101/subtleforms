import { memo } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import clsx from 'clsx';
import Icon from '../ui/Icon';
import { getIcon } from './utils/iconMap';
import './GroupRenderer.scss';

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
      className={ clsx( 'sf-group-renderer', { 'is-selected': isSelected } ) }
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
      } }>
      {/* Header bar */}
      <div className='sf-group-renderer__header'>
        <div className='sf-group-renderer__header-left'>
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
              className='sf-group-renderer__drag-handle'>
              <Icon.Move size={ 14 } />
            </button>
          ) }
          { NodeIcon && (
            <span className='sf-group-renderer__icon'>
              <NodeIcon size={ 14 } />
            </span>
          ) }
          <span className='sf-group-renderer__label'>{ label }</span>
        </div>
        <button
          type='button'
          className='sf-group-renderer__delete-btn'
          aria-label={ __( 'Delete group', 'subtleforms' ) }
          onClick={ ( e ) => {
            e.stopPropagation();
            onDelete();
          } }>
          <Icon.Trash2 size={ 14 } />
        </button>
      </div>
      {/* Children */}
      <div className='sf-group-renderer__body'>
        { children }
      </div>
    </div>
  );
} );

export default GroupRenderer;
