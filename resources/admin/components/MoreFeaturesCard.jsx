import { useState } from '@wordpress/element';
import { Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { apiClient } from '../data/apiClient';
import Icon from '../ui/Icon';
import './MoreFeaturesCard.scss';

/**
 * Dashboard card: what the separate SubtleForms Pro plugin adds, with one
 * link to its page. Information only: nothing in this plugin depends on it.
 *
 * The server decides whether it shows (subtleformsAdmin.moreFeatures.show):
 * not after this user dismissed it and not while the add-on is active.
 * Dismissing it is remembered for the user.
 *
 * @param {Object} props
 * @param {Object} props.data Card data (tests); read from the page when omitted.
 */
export default function MoreFeaturesCard({ data }) {
  const card = data || window.subtleformsAdmin?.moreFeatures || null;
  const [hidden, setHidden] = useState(false);

  if (!card || !card.show || !card.url || hidden) {
    return null;
  }

  const dismiss = () => {
    setHidden(true);
    apiClient.post('/more-features/dismiss', {}).catch(() => {
      // Hidden for this page view either way; it comes back on the next
      // load only when the server did not store the choice.
    });
  };

  return (
    <section className='sf-panel sf-more-features' aria-labelledby='sf-more-features-title'>
      <header className='sf-panel__header'>
        <h2 className='sf-panel__title' id='sf-more-features-title'>
          {__('More features', 'subtleforms')}
        </h2>
        <Button
          className='sf-more-features__dismiss'
          icon={<Icon.Close size={16} aria-hidden='true' />}
          label={__('Dismiss', 'subtleforms')}
          size='small'
          onClick={dismiss}
        />
      </header>
      <div className='sf-panel__body'>
        <p className='sf-more-features__intro'>
          {__('SubtleForms Pro is a separate plugin that adds:', 'subtleforms')}
        </p>
        <ul className='sf-more-features__list'>
          <li>{__('Signature, Calculation and Picture choice fields, and several files per upload field', 'subtleforms')}</li>
          <li>{__('Stripe payments, coupons and WooCommerce checkout', 'subtleforms')}</li>
          <li>{__('Mailchimp, Brevo, Kit, HubSpot and Zapier', 'subtleforms')}</li>
          <li>{__('More conditional logic options, form analytics, entry PDFs and translation with WPML or Polylang', 'subtleforms')}</li>
        </ul>
        <a className='sf-more-features__link' href={card.url} target='_blank' rel='noopener noreferrer'>
          {__('About SubtleForms Pro', 'subtleforms')}
          <span className='screen-reader-text'> {__('(opens in a new tab)', 'subtleforms')}</span>
        </a>
      </div>
    </section>
  );
}
