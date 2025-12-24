import { useState } from '@wordpress/element';
import { Button, Icon } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { getIcon } from './utils/iconMap';

export default function FieldDock({ fieldGroups, onAddField }) {
  const [collapsed, setCollapsed] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState({});

  const toggleGroup = (category) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  if (!fieldGroups || Object.keys(fieldGroups).length === 0) {
    return (
      <div
        style={{
          width: collapsed ? '48px' : '280px',
          background: '#fafafa',
          borderRight: '1px solid #ddd',
          display: 'flex',
          flexDirection: 'column',
          transition: 'width 0.2s',
        }}>
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid #ddd',
            background: '#fff',
          }}>
          <p style={{ margin: 0, color: '#8c8f94', fontSize: '13px' }}>
            {__('Loading fields...', 'subtleforms')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        width: collapsed ? '48px' : '280px',
        background: '#fafafa',
        borderRight: '1px solid #ddd',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.2s',
        height: '100%',
      }}>
      {/* Sticky Header */}
      <div
        style={{
          flexShrink: 0,
          background: '#fff',
          padding: '12px 16px',
          borderBottom: '1px solid #ddd',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
        {!collapsed && (
          <h3
            style={{
              margin: 0,
              fontSize: '14px',
              fontWeight: 600,
              color: '#1e1e1e',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}>
            {__('Fields', 'subtleforms')}
          </h3>
        )}
        <Button
          isSmall
          onClick={() => setCollapsed(!collapsed)}
          style={{
            minWidth: 0,
            padding: '4px 8px',
          }}
          title={
            collapsed
              ? __('Expand', 'subtleforms')
              : __('Collapse', 'subtleforms')
          }>
          {collapsed ? '→' : '←'}
        </Button>
      </div>

      {/* Scrollable Content */}
      {!collapsed && (
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '16px 12px',
          }}>
          {Object.entries(fieldGroups).map(([category, categoryFields]) => {
            const isCollapsed = collapsedGroups[category];
            return (
              <div key={category} style={{ marginBottom: '16px' }}>
                {/* Category Header */}
                <button
                  type='button'
                  onClick={() => toggleGroup(category)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    outline: 'none',
                    marginBottom: '8px',
                  }}>
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#50575e',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}>
                    {category}
                  </span>
                  <span
                    style={{
                      fontSize: '10px',
                      color: '#8c8f94',
                      transform: isCollapsed
                        ? 'rotate(-90deg)'
                        : 'rotate(0deg)',
                      transition: 'transform 0.2s',
                    }}>
                    ▼
                  </span>
                </button>

                {/* Field Cards */}
                {!isCollapsed && (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '8px',
                    }}>
                    {categoryFields.map((f) => (
                      <button
                        key={f.type}
                        type='button'
                        onClick={() => onAddField(f.type)}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          padding: '12px 8px',
                          background: '#fff',
                          border: '1px solid #ddd',
                          cursor: 'pointer',
                          outline: 'none',
                          transition: 'all 0.15s',
                          minHeight: '70px',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = '#2271b1';
                          e.currentTarget.style.background = '#f6f7f7';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = '#ddd';
                          e.currentTarget.style.background = '#fff';
                        }}>
                        <span
                          style={{
                            display: 'flex',
                            color: '#50575e',
                          }}>
                          <Icon icon={getIcon(f.type)} size={20} />
                        </span>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 500,
                            color: '#1e1e1e',
                            textAlign: 'center',
                            lineHeight: 1.3,
                            wordBreak: 'break-word',
                          }}>
                          {f.label}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
