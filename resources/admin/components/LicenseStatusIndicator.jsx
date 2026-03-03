import { __ } from '@wordpress/i18n';
import clsx from 'clsx';

/**
 * LicenseStatusIndicator Component (Free — placeholder)
 *
 * When SubtleForms Pro is installed this component is replaced by the
 * Pro version via the global `window.SubtleFormsPro` slot.  In the free
 * plugin this renders a subtle "Upgrade to Pro" link, or nothing if the
 * variant is 'inline'.
 *
 * Props:
 * - variant: 'full' | 'compact' | 'inline'
 * - showDescription: boolean
 * - className: string
 */
export default function LicenseStatusIndicator({
  variant = 'full',
  // eslint-disable-next-line no-unused-vars
  showDescription = false,
  className = '',
}) {
  // If Pro is loaded, delegate to its component.
  if ( window.SubtleFormsPro?.ProFeatureBadge ) {
    const Badge = window.SubtleFormsPro.ProFeatureBadge;
    return <Badge active={ false } compact={ variant !== 'full' } />;
  }

  // Inline variant: don't clutter the builder header.
  if ( variant === 'inline' ) {
    return null;
  }

  return (
    <a
      href="https://subtleforms.com/pro"
      target="_blank"
      rel="noopener noreferrer"
      className={ clsx( 'sf-license-status', `sf-license-status--${ variant }`, 'sf-license-status--neutral', className ) }
    >
      <span className="sf-license-status__label">
        { __( 'Upgrade to Pro', 'subtleforms' ) }
      </span>
    </a>
  );
}
