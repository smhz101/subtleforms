import { __ } from '@wordpress/i18n';
import { Icon } from '@wordpress/components';
import { getIcon } from './utils/iconMap';

export default function InlineAddButton({
  index,
  isHovered,
  showFieldPicker,
  onHover,
  onLeave,
  onClick,
  anchorRef,
}) {
  return (
    <div
      style={{
        textAlign: 'center',
        padding: '12px 0',
        marginBottom: 16,
        opacity: isHovered || showFieldPicker ? 1 : 0.3,
        transition: 'opacity 0.2s',
      }}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}>
      <button
        ref={anchorRef}
        onClick={onClick}
        style={{
          padding: '6px 16px',
          fontSize: '12px',
          border: '1px dashed #bbb',
          background: 'transparent',
          borderRadius: '4px',
          cursor: 'pointer',
          color: '#666',
          fontWeight: 500,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
        }}>
        <Icon icon={getIcon('add')} size={16} />
        {__('Insert Field', 'subtleforms')}
      </button>
    </div>
  );
}
