/**
 * Spinner Component
 */

import './loading.scss';

export function Spinner({ size = 'medium', className = '' }) {
  return (
    <div className={`sf-spinner sf-spinner--${size} ${className}`}>
      <div className="sf-spinner__circle" />
    </div>
  );
}

export function InlineSpinner({ text }) {
  return (
    <div className="sf-inline-spinner">
      <Spinner size="small" />
      {text && <span className="sf-inline-spinner__text">{text}</span>}
    </div>
  );
}
