import { useMemo } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import clsx from 'clsx';
import {
  getLicenseState,
  getLicenseStateLabel,
  getLicenseStateDescription,
  getLicenseStateColor,
  getProLicenseUrl,
} from '../utils/licenseState';
import './LicenseStatusIndicator.scss';

/**
 * LicenseStatusIndicator Component
 *
 * Displays current license state consistently across admin.
 * Shows: label, description, and clickable link to license page.
 *
 * Props:
 * - variant: 'full' | 'compact' | 'inline' (default: 'full')
 * - showDescription: boolean (default: true for full, false for compact/inline)
 * - className: string (optional)
 */
export default function LicenseStatusIndicator({
  variant = 'full',
  showDescription = variant === 'full',
  className = '',
}) {
  const state = useMemo(() => getLicenseState(), []);
  const label = useMemo(() => getLicenseStateLabel(state), [state]);
  const description = useMemo(() => getLicenseStateDescription(state), [state]);
  const color = useMemo(() => getLicenseStateColor(state), [state]);
  const licenseUrl = useMemo(() => getProLicenseUrl(), []);

  // Don't show indicator if no Pro plugin
  if (state === 'inactive' && !window.subtleformsAdmin?.hasProPlugin) {
    return null;
  }

  const handleClick = (e) => {
    e.preventDefault();
    window.location.href = licenseUrl;
  };

  return (
    <div
      className={clsx(
        'sf-license-status',
        `sf-license-status--${variant}`,
        `sf-license-status--${color}`,
        className
      )}
      role="status"
      aria-live="polite">
      <button
        type="button"
        className="sf-license-status__button"
        onClick={handleClick}
        title={__('View license settings', 'subtleforms')}>
        <span className="sf-license-status__indicator" aria-hidden="true" />
        
        <span className="sf-license-status__content">
          <span className="sf-license-status__label">{label}</span>
          
          {showDescription && description && (
            <span className="sf-license-status__description">
              {description}
            </span>
          )}
        </span>
      </button>
    </div>
  );
}
