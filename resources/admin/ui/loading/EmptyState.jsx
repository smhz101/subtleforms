/**
 * Empty State Component
 */

import { __ } from '@wordpress/i18n';
import './loading.scss';

export function EmptyState({ 
  icon, 
  title, 
  description, 
  action,
  actionLabel,
  onAction 
}) {
  return (
    <div className="sf-empty-state">
      {icon && <div className="sf-empty-state__icon">{icon}</div>}
      {title && <h3 className="sf-empty-state__title">{title}</h3>}
      {description && <p className="sf-empty-state__description">{description}</p>}
      {action && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="sf-empty-state__action"
        >
          {actionLabel || __('Get Started', 'subtleforms')}
        </button>
      )}
    </div>
  );
}
