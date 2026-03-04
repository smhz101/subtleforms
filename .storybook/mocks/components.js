/**
 * Mock for @wordpress/components
 * Provides minimal stubs so components that import WP buttons/inputs
 * render without errors in Storybook.
 */
import React from 'react';

export const Button = ({ children, onClick, variant, isSmall, isPrimary, isSecondary, isDestructive, disabled, href, ...rest }) => {
  const cls = ['sb-wp-button', variant, isSmall && 'small', isPrimary && 'primary', isSecondary && 'secondary', isDestructive && 'destructive']
    .filter(Boolean).join(' ');
  if (href) return <a href={href} className={cls} {...rest}>{children}</a>;
  return <button type="button" className={cls} onClick={onClick} disabled={disabled} {...rest}>{children}</button>;
};

export const TextControl = ({ label, value, onChange, ...rest }) => (
  <label style={{ display: 'block' }}>
    {label && <span>{label}</span>}
    <input type="text" value={value ?? ''} onChange={(e) => onChange?.(e.target.value)} {...rest} />
  </label>
);

export const SelectControl = ({ label, value, options = [], onChange, ...rest }) => (
  <label style={{ display: 'block' }}>
    {label && <span>{label}</span>}
    <select value={value} onChange={(e) => onChange?.(e.target.value)} {...rest}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </label>
);

export const CheckboxControl = ({ label, checked, onChange, indeterminate, ...rest }) => (
  <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
    <input type="checkbox" checked={checked ?? false} onChange={(e) => onChange?.(e.target.checked)} {...rest} />
    {label && <span>{label}</span>}
  </label>
);

export const TextareaControl = ({ label, value, onChange, ...rest }) => (
  <label style={{ display: 'block' }}>
    {label && <span>{label}</span>}
    <textarea value={value ?? ''} onChange={(e) => onChange?.(e.target.value)} {...rest} />
  </label>
);

export const Panel = ({ children, ...rest }) => <div className="sb-wp-panel" {...rest}>{children}</div>;
export const PanelBody = ({ children, title, ...rest }) => (
  <div className="sb-wp-panel-body" {...rest}>
    {title && <h3 style={{ margin: '0 0 8px' }}>{title}</h3>}
    {children}
  </div>
);
export const PanelRow = ({ children, ...rest }) => <div className="sb-wp-panel-row" {...rest}>{children}</div>;
export const Card = ({ children, ...rest }) => <div className="sb-wp-card" style={{ border: '1px solid #ddd', borderRadius: 4, padding: 16 }} {...rest}>{children}</div>;
export const CardHeader = ({ children, ...rest }) => <div className="sb-wp-card-header" style={{ fontWeight: 600, marginBottom: 8 }} {...rest}>{children}</div>;
export const CardBody = ({ children, ...rest }) => <div className="sb-wp-card-body" {...rest}>{children}</div>;
export const CardFooter = ({ children, ...rest }) => <div className="sb-wp-card-footer" style={{ marginTop: 8 }} {...rest}>{children}</div>;
export const Spinner = () => <span className="sb-wp-spinner" style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid #ccc', borderTopColor: '#333', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }}>​</span>;
export const Notice = ({ children, status = 'info', ...rest }) => <div className={`sb-wp-notice sb-wp-notice-${status}`} role="alert" {...rest}>{children}</div>;
export const Modal = ({ children, title, onRequestClose, isOpen, ...rest }) => {
  if (!isOpen) return null;
  return (
    <div className="sb-wp-modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
      <div className="sb-wp-modal" style={{ background: '#fff', borderRadius: 4, padding: 24, maxWidth: 600, width: '100%' }} role="dialog" {...rest}>
        {title && <h2 style={{ marginTop: 0 }}>{title}</h2>}
        {children}
        <button type="button" onClick={onRequestClose} style={{ float: 'right' }}>✕</button>
      </div>
    </div>
  );
};

export const __experimentalHStack = ({ children, ...rest }) => <div style={{ display: 'flex', gap: 8, alignItems: 'center' }} {...rest}>{children}</div>;
export const __experimentalVStack = ({ children, ...rest }) => <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} {...rest}>{children}</div>;
export const SearchControl = ({ value, onChange, placeholder, ...rest }) => (
  <input type="search" value={value ?? ''} onChange={(e) => onChange?.(e.target.value)} placeholder={placeholder} {...rest} />
);

export default {};
