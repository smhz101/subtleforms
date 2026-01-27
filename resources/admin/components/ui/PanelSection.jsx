/**
 * PanelSection - Collapsible section for progressive disclosure
 * 
 * Provides a clean, accessible way to hide advanced options
 * until the user explicitly requests them.
 */

import { useState } from '@wordpress/element';
import { Icon } from '@wordpress/components';
import { chevronDown, chevronUp } from '@wordpress/icons';
import './PanelSection.scss';

export default function PanelSection({
  title,
  children,
  initialOpen = false,
  variant = 'default', // 'default' | 'subtle'
  className = '',
}) {
  const [isOpen, setIsOpen] = useState(initialOpen);

  return (
    <div className={`sf-panel-section sf-panel-section--${variant} ${className}`}>
      <button
        type="button"
        className="sf-panel-section__toggle"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}>
        <span className="sf-panel-section__title">{title}</span>
        <Icon
          icon={isOpen ? chevronUp : chevronDown}
          className="sf-panel-section__icon"
        />
      </button>
      {isOpen && (
        <div className="sf-panel-section__content">
          {children}
        </div>
      )}
    </div>
  );
}
