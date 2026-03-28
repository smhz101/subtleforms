/**
 * Upgrade Prompt Component
 *
 * Contextual, non-disruptive upgrade messaging for Pro features.
 * Shows relevant benefits and provides clear path to upgrade.
 * 
 * @param {Object} props
 * @param {string} [props.feature] - Feature name or title
 * @param {string[]} [props.benefits] - List of benefit descriptions
 * @param {'inline'|'card'|'banner'} [props.variant='inline'] - Visual style variant
 * @param {boolean} [props.showIcon=true] - Whether to show the star icon
 * @param {string} [props.ctaText] - Custom CTA button text
 * @param {Function} [props.onUpgrade] - Custom upgrade handler (defaults to pro license page)
 * 
 * @example
 * <UpgradePrompt 
 *   variant="card"
 *   feature="Advanced Analytics"
 *   benefits={['Track conversions', 'Export reports', 'Real-time insights']}
 * />
 */

import { Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import Icon from './Icon';
import './UpgradePrompt.scss';

export function getUpgradeUrl(feature = '') {
  const base = window.subtleformsAdmin?.proUrl || 'https://subtleforms.com/pro';
  return feature
    ? `${base}?utm_source=plugin&utm_medium=upgrade&utm_campaign=${encodeURIComponent(feature)}`
    : base;
}

export default function UpgradePrompt({
  feature,
  benefits = [],
  variant = 'inline',
  showIcon = true,
  ctaText,
  onUpgrade,
}) {
  const defaultCtaText = __('Upgrade to Pro', 'subtleforms');
  
  const handleUpgrade = () => {
    if (onUpgrade) {
      onUpgrade();
    } else {
      window.open(getUpgradeUrl(feature || ''), '_blank');
    }
  };

  return (
    <div className={`sf-upgrade-prompt sf-upgrade-prompt--${variant}`}>
      {showIcon && (
        <div className='sf-upgrade-prompt__icon'>
          <Icon.Star />
        </div>
      )}
      
      <div className='sf-upgrade-prompt__content'>
        {feature && (
          <h4 className='sf-upgrade-prompt__title'>
            {feature}
          </h4>
        )}
        
        {benefits.length > 0 && (
          <ul className='sf-upgrade-prompt__benefits'>
            {benefits.map((benefit, index) => (
              <li key={index} className='sf-upgrade-prompt__benefit'>
                <Icon.Check className='sf-upgrade-prompt__check' />
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      
      <div className='sf-upgrade-prompt__actions'>
        <Button
          variant='primary'
          onClick={handleUpgrade}
          className='sf-upgrade-prompt__button'>
          {ctaText || defaultCtaText}
        </Button>
      </div>
    </div>
  );
}
