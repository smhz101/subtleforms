import { useState } from '@wordpress/element';
import { Button, Icon } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { getIcon } from './utils/iconMap';

export default function FieldDock({ fieldGroups, onAddField }) {
  const [collapsed, setCollapsed] = useState(false);

  if (!fieldGroups || Object.keys(fieldGroups).length === 0) {
    return (
      <div className={`subtleforms-field-dock ${collapsed ? 'subtleforms-field-dock--collapsed' : ''}`}>
        <div className="subtleforms-field-dock__header">
          <p style={{ color: '#646970', fontSize: '13px', margin: 0 }}>
            {__('Loading fields...', 'subtleforms')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`subtleforms-field-dock ${collapsed ? 'subtleforms-field-dock--collapsed' : ''}`}>
      <div className="subtleforms-field-dock__header">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
          {!collapsed && (
            <strong
              style={{
                fontSize: '15px',
                color: '#1e1e1e',
                fontWeight: 600,
              }}>
              {__('Add Fields', 'subtleforms')}
            </strong>
          )}
          <Button
            isSmall
            onClick={() => setCollapsed(!collapsed)}
            style={{ minWidth: 'auto', padding: '4px 8px' }}>
            {collapsed ? '→' : '←'}
          </Button>
        </div>
      </div>

      {!collapsed && (
        <div className="subtleforms-field-dock__content">
          {Object.entries(fieldGroups).map(([category, categoryFields]) => (
            <div key={category} style={{ marginBottom: 20 }}>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#646970',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginBottom: 10,
                }}>
                {category}
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '8px',
                }}>
                {categoryFields.map((f) => (
                  <button
                    type='button'
                    key={f.type}
                    onClick={() => onAddField(f.type)}
                    className='subtleforms-field-dock-button'
                    style={{
                      padding: '12px 8px',
                      background: '#f9f9f9',
                      border: '1px solid #e5e5e5',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '12px',
                      color: '#1e1e1e',
                      transition: 'all 0.15s',
                      textAlign: 'center',
                    }}>
                    <span style={{ fontSize: '20px', display: 'flex' }}>
                      <Icon icon={getIcon(f.type)} size={24} />
                    </span>
                    <span
                      style={{
                        fontWeight: 500,
                        lineHeight: '1.3',
                        wordBreak: 'break-word',
                      }}>
                      {f.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
