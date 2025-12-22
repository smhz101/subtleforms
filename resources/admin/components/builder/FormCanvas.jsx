import { __ } from '@wordpress/i18n';
import { Icon } from '@wordpress/components';
import FieldList from './FieldList';
import { getIcon } from './utils/iconMap';

export default function FormCanvas({
  schema,
  fields,
  selectedIndex,
  hoveredIndex,
  showFieldPicker,
  fieldPickerAnchorRef,
  onSelect,
  onHover,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onDelete,
  onShowPicker,
}) {
  return (
    <div
      style={{
        flex: 1,
        overflow: 'auto',
        padding: '32px',
        background: '#f6f7f7',
      }}>
      <div
        style={{
          maxWidth: '720px',
          margin: '0 auto',
          background: '#fff',
          padding: '48px',
          borderRadius: '8px',
          boxShadow: '0 2px 16px rgba(0,0,0,0.08)',
          minHeight: '500px',
        }}>
        {/* Form Title */}
        <div style={{ marginBottom: 32 }}>
          <h3
            style={{
              margin: '0 0 8px 0',
              fontSize: '24px',
              fontWeight: 600,
              color: '#1e1e1e',
            }}>
            {schema?.metadata?.title || __('Untitled Form', 'subtleforms')}
          </h3>
          <p style={{ margin: 0, fontSize: '14px', color: '#757575' }}>
            {schema?.metadata?.description ||
              __('Fill out the form below', 'subtleforms')}
          </p>
        </div>

        {/* Empty State */}
        {fields.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              padding: '80px 20px',
              color: '#999',
            }}>
            <div
              style={{
                marginBottom: 16,
                display: 'flex',
                justifyContent: 'center',
              }}>
              <Icon icon={getIcon('default')} size={56} />
            </div>
            <h4
              style={{
                margin: '0 0 8px 0',
                fontSize: '18px',
                fontWeight: 600,
                color: '#666',
              }}>
              {__('Start Building Your Form', 'subtleforms')}
            </h4>
            <p style={{ margin: 0, fontSize: '14px', color: '#999' }}>
              {__('Add fields from the left sidebar to begin', 'subtleforms')}
            </p>
          </div>
        )}

        {/* Form Fields */}
        <FieldList
          fields={fields}
          parentPath={[]}
          selectedIndex={selectedIndex}
          hoveredIndex={hoveredIndex}
          showFieldPicker={showFieldPicker}
          onSelect={onSelect}
          onHover={onHover}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
          onShowPicker={onShowPicker}
        />
      </div>
    </div>
  );
}
