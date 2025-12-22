import { __ } from '@wordpress/i18n';

export default function FieldRenderer({ field }) {
  const { type, label, required, placeholder, options, subFields } = field;

  const labelStyle = {
    display: 'block',
    marginBottom: '8px',
    fontSize: '14px',
    fontWeight: 500,
    color: '#1e1e1e',
  };

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    fontSize: '14px',
    border: '1px solid #8c8f94',
    borderRadius: '4px',
    fontFamily: 'inherit',
    pointerEvents: 'none',
  };

  const selectStyle = {
    ...inputStyle,
    appearance: 'none',
    background: `#fff url('data:image/svg+xml;utf8,<svg fill="%238c8f94" height="20" viewBox="0 0 20 20" width="20" xmlns="http://www.w3.org/2000/svg"><path d="M5 6l5 5 5-5 2 1-7 7-7-7z"/></svg>') no-repeat right 8px center`,
    backgroundSize: '20px',
    paddingRight: '36px',
  };

  return (
    <div>
      {/* Label */}
      <label style={labelStyle}>
        {label || field.name}
        {required && (
          <span style={{ color: '#d63638', marginLeft: '4px' }}>*</span>
        )}
      </label>

      {/* Render appropriate input based on type */}
      {(type === 'text' ||
        type === 'email' ||
        type === 'phone' ||
        type === 'url') && (
        <input
          type={type === 'email' ? 'email' : type === 'url' ? 'url' : 'text'}
          placeholder={placeholder || ''}
          style={inputStyle}
          readOnly
        />
      )}

      {type === 'number' && (
        <input
          type='number'
          placeholder={placeholder || ''}
          style={inputStyle}
          readOnly
        />
      )}

      {type === 'textarea' && (
        <textarea
          rows={4}
          placeholder={placeholder || ''}
          style={{ ...inputStyle, resize: 'vertical' }}
          readOnly
        />
      )}

      {type === 'checkbox' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type='checkbox'
            style={{ width: '18px', height: '18px', pointerEvents: 'none' }}
          />
          <span style={{ fontSize: '14px' }}>{label}</span>
        </div>
      )}

      {type === 'radio' && options && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {options.map((opt, idx) => (
            <div
              key={idx}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type='radio'
                name={field.key}
                style={{ width: '18px', height: '18px', pointerEvents: 'none' }}
              />
              <span style={{ fontSize: '14px' }}>{opt.label}</span>
            </div>
          ))}
        </div>
      )}

      {type === 'multiple_choice' && options && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {options.map((opt, idx) => (
            <div
              key={idx}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type='checkbox'
                style={{ width: '18px', height: '18px', pointerEvents: 'none' }}
              />
              <span style={{ fontSize: '14px' }}>{opt.label}</span>
            </div>
          ))}
        </div>
      )}

      {type === 'dropdown' && options && (
        <select style={selectStyle} disabled>
          <option>
            {placeholder || __('Select an option', 'subtleforms')}
          </option>
          {options.map((opt, idx) => (
            <option key={idx} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )}

      {type === 'date' && <input type='date' style={inputStyle} readOnly />}

      {type === 'time' && <input type='time' style={inputStyle} readOnly />}

      {type === 'datetime' && (
        <input type='datetime-local' style={inputStyle} readOnly />
      )}

      {type === 'country' && (
        <select style={selectStyle} disabled>
          <option>{__('Select a country', 'subtleforms')}</option>
          <option>United States</option>
          <option>Canada</option>
          <option>United Kingdom</option>
        </select>
      )}

      {type === 'hidden' && (
        <div
          style={{
            padding: '12px',
            background: '#f0f0f0',
            border: '1px dashed #999',
            borderRadius: '4px',
            fontSize: '13px',
            color: '#666',
            fontStyle: 'italic',
          }}>
          {__('Hidden field (not visible to users)', 'subtleforms')}
        </div>
      )}

      {type === 'html' && (
        <div
          style={{
            padding: '12px',
            background: '#fffbea',
            border: '1px solid #f59e0b',
            borderRadius: '4px',
            fontSize: '13px',
            color: '#92400e',
          }}>
          📝 {__('HTML Content Block', 'subtleforms')}
        </div>
      )}

      {type === 'image_upload' && (
        <div
          style={{
            border: '2px dashed #8c8f94',
            borderRadius: '4px',
            padding: '40px 20px',
            textAlign: 'center',
            background: '#fafafa',
          }}>
          <div style={{ fontSize: '40px', marginBottom: '8px' }}>🖼️</div>
          <div style={{ fontSize: '13px', color: '#666' }}>
            {__('Click to upload or drag image here', 'subtleforms')}
          </div>
        </div>
      )}

      {type === 'file_upload' && (
        <div
          style={{
            border: '2px dashed #8c8f94',
            borderRadius: '4px',
            padding: '40px 20px',
            textAlign: 'center',
            background: '#fafafa',
          }}>
          <div style={{ fontSize: '40px', marginBottom: '8px' }}>📎</div>
          <div style={{ fontSize: '13px', color: '#666' }}>
            {__('Click to upload or drag file here', 'subtleforms')}
          </div>
        </div>
      )}

      {/* Composite field: Address */}
      {type === 'address' && subFields && (
        <div
          style={{
            padding: '16px',
            background: '#f9f9f9',
            border: '1px solid #ddd',
            borderRadius: '4px',
          }}>
          {subFields.map((sub, idx) => (
            <div
              key={idx}
              style={{ marginBottom: idx < subFields.length - 1 ? '12px' : 0 }}>
              <label style={{ ...labelStyle, marginBottom: '4px' }}>
                {sub.label}
                {sub.required && (
                  <span style={{ color: '#d63638', marginLeft: '4px' }}>*</span>
                )}
              </label>
              <input type='text' style={inputStyle} readOnly />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
