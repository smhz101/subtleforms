/**
 * ContextualTip - Inline hint for features
 * 
 * Shows helpful tips contextually without interrupting workflow.
 * Dismissible and remembers state in localStorage.
 * 
 * @param {Object} props
 * @param {string} props.id - Unique ID for localStorage persistence (required)
 * @param {React.ReactNode} props.children - Tip content
 * @param {'info'|'success'|'warning'} [props.variant='info'] - Visual style
 * @param {boolean} [props.dismissible=true] - Whether user can dismiss the tip
 * 
 * @example
 * <ContextualTip id="builder-first-field" variant="info">
 *   👋 Click "Add Field" or drag from the left panel
 * </ContextualTip>
 */

import { useState, useEffect } from '@wordpress/element';
import { Icon } from '@wordpress/components';
import { info, close } from '@wordpress/icons';
import './ContextualTip.scss';

export default function ContextualTip({ 
  id, 
  children, 
  variant = 'info',
  dismissible = true 
}) {
  const storageKey = `sf-tip-dismissed-${id}`;
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (dismissible) {
      const isDismissed = localStorage.getItem(storageKey) === 'true';
      setDismissed(isDismissed);
    }
  }, [storageKey, dismissible]);

  const handleDismiss = () => {
    localStorage.setItem(storageKey, 'true');
    setDismissed(true);
  };

  if (dismissed) return null;

  return (
    <div className={`sf-contextual-tip sf-contextual-tip--${variant}`}>
      <Icon icon={info} className="sf-contextual-tip__icon" />
      <div className="sf-contextual-tip__content">
        {children}
      </div>
      {dismissible && (
        <button
          type="button"
          className="sf-contextual-tip__dismiss"
          onClick={handleDismiss}
          aria-label="Dismiss tip">
          <Icon icon={close} />
        </button>
      )}
    </div>
  );
}
