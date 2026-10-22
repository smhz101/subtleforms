/**
 * Pro placeholders.
 *
 * Small, flat notes that tell a feature is part of SubtleForms Pro and link to
 * the upgrade page. They hold no feature code: no settings, no working
 * controls, only text and a link. White label sites show nothing.
 */
import { __ } from '@wordpress/i18n';
import { getBranding } from '../utils/branding';
import { getUpgradeUrl } from './UpgradePrompt';
import { openUpgradeModal } from '../utils/featureGate';
import './ProNotice.scss';

/** A flat "Pro" label. */
export function ProTag({ className = '' }) {
  if (getBranding().hideUpgrade) {
    return null;
  }
  return <span className={`sf-pro-tag ${className}`.trim()}>{__('Pro', 'subtleforms')}</span>;
}

/**
 * A link to the upgrade page for a feature. It opens the upgrade modal, which
 * explains the feature; the modal links on to the upgrade page.
 */
export function ProUpgradeLink({ feature, label, className = '' }) {
  if (getBranding().hideUpgrade) {
    return null;
  }
  return (
    <a
      className={`sf-pro-link ${className}`.trim()}
      href={getUpgradeUrl(feature)}
      target='_blank'
      rel='noopener noreferrer'
      onClick={(e) => {
        e.preventDefault();
        openUpgradeModal(feature, { label });
      }}>
      {__('Upgrade to Pro', 'subtleforms')}
    </a>
  );
}

/**
 * A setting that SubtleForms Pro provides: its label, a Pro tag, what it does and an
 * upgrade link. Nothing here changes the form.
 */
export default function ProNotice({ label, help, feature }) {
  return (
    <div className='sf-pro-notice' data-feature={feature}>
      <div className='sf-pro-notice__head'>
        <span className='sf-pro-notice__label'>{label}</span>
        <ProTag />
      </div>
      {help && <p className='sf-pro-notice__help'>{help}</p>}
      <ProUpgradeLink feature={feature} label={label} />
    </div>
  );
}
