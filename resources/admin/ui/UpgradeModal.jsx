/**
 * UpgradeModal, Global event-driven Pro upgrade modal.
 *
 * Mount once in AppContent. Listens for 'sf:upgrade:required' custom DOM events
 * dispatched by featureGate.js#openUpgradeModal / #requirePro.
 *
 * Event payload: { featureKey: string, label?: string, slug?: string }
 */

import { useState, useEffect } from '@wordpress/element';
import { Modal, Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import Icon from './Icon';
import UpgradePrompt, { getUpgradeUrl } from './UpgradePrompt';
import { getBranding } from '../utils/branding';
import './UpgradeModal.scss';

// ─── Feature copy table ───────────────────────────────────────────────────────
// Keys should match the capability / context keys used when calling requirePro().

const FEATURE_COPY = {
  'fields.advanced': {
    title: __( 'Signature and Calculation fields', 'subtleforms' ),
    description: __( 'SubtleForms Pro adds a Signature pad and Calculation fields with a formula builder.', 'subtleforms' ),
    cta: __( 'About SubtleForms Pro', 'subtleforms' ),
    lossLine: null,
    benefits: [
      __( 'Signature pad that works on touch screens', 'subtleforms' ),
      __( 'Calculations worked out live and checked again on the server', 'subtleforms' ),
      __( 'Use a calculation as the amount to charge', 'subtleforms' ),
    ],
  },

  'templates.pro': {
    title: __( 'More templates', 'subtleforms' ),
    description: __( 'SubtleForms Pro adds 47 templates for registrations, orders, applications and support.', 'subtleforms' ),
    cta: __( 'About SubtleForms Pro', 'subtleforms' ),
    lossLine: null,
    benefits: [
      __( 'Multi-step, conversational and payment layouts', 'subtleforms' ),
      __( 'Every field and setting stays editable', 'subtleforms' ),
      __( 'New templates added with updates', 'subtleforms' ),
    ],
  },

  'actions.payment': {
    title: __( 'Card payments', 'subtleforms' ),
    description: __( 'SubtleForms Pro adds a Card Payment field that takes payments with Stripe.', 'subtleforms' ),
    cta: __( 'About SubtleForms Pro', 'subtleforms' ),
    lossLine: null,
    benefits: [
      __( 'Cards, wallets and bank payments through Stripe', 'subtleforms' ),
      __( 'Works with the free Product, Priced Options and Coupon fields', 'subtleforms' ),
      __( 'Payment status on every entry', 'subtleforms' ),
    ],
  },

  'extensions.payments': {
    title: __( 'Card payments', 'subtleforms' ),
    description: __( 'SubtleForms Pro adds a Card Payment field that takes payments with Stripe.', 'subtleforms' ),
    cta: __( 'About SubtleForms Pro', 'subtleforms' ),
    lossLine: null,
    benefits: [
      __( 'Cards, wallets and bank payments through Stripe', 'subtleforms' ),
      __( 'Works with the free Product, Priced Options and Coupon fields', 'subtleforms' ),
      __( 'Payment status on every entry', 'subtleforms' ),
    ],
  },

  'extensions.email_marketing': {
    title: __( 'Email marketing', 'subtleforms' ),
    description: __( 'SubtleForms Pro adds people who send a form to Mailchimp, Brevo or Kit.', 'subtleforms' ),
    cta: __( 'About SubtleForms Pro', 'subtleforms' ),
    lossLine: null,
    benefits: [
      __( 'Choose the list and map fields per form', 'subtleforms' ),
      __( 'Only add people who ticked a consent box', 'subtleforms' ),
      __( 'Every delivery is listed on the entry', 'subtleforms' ),
    ],
  },

  'extensions.crm': {
    title: __( 'CRM', 'subtleforms' ),
    description: __( 'SubtleForms Pro creates HubSpot contacts from form entries.', 'subtleforms' ),
    cta: __( 'About SubtleForms Pro', 'subtleforms' ),
    lossLine: null,
    benefits: [
      __( 'Map form fields to contact properties', 'subtleforms' ),
      __( 'Update the contact when the email already exists', 'subtleforms' ),
      __( 'Every delivery is listed on the entry', 'subtleforms' ),
    ],
  },

  'extensions.ecommerce': {
    title: __( 'WooCommerce', 'subtleforms' ),
    description: __( 'SubtleForms Pro sends payment forms through the WooCommerce checkout and adds a WooCommerce Product field.', 'subtleforms' ),
    cta: __( 'About SubtleForms Pro', 'subtleforms' ),
    lossLine: null,
    benefits: [
      __( 'Use the payment methods WooCommerce already has', 'subtleforms' ),
      __( 'Orders link back to the form entry', 'subtleforms' ),
      __( 'Sell existing WooCommerce products from a form', 'subtleforms' ),
    ],
  },

  'integrations.woocommerce': {
    title: __( 'WooCommerce checkout', 'subtleforms' ),
    description: __( 'SubtleForms Pro sends payment forms through the WooCommerce checkout.', 'subtleforms' ),
    cta: __( 'About SubtleForms Pro', 'subtleforms' ),
    lossLine: null,
    benefits: [
      __( 'Use the payment methods WooCommerce already has', 'subtleforms' ),
      __( 'Orders link back to the form entry', 'subtleforms' ),
      __( 'Sell existing WooCommerce products from a form', 'subtleforms' ),
    ],
  },

  'extensions.pdf': {
    title: __( 'Entry PDFs', 'subtleforms' ),
    description: __( 'SubtleForms Pro makes a PDF of any entry and can attach it to notification emails.', 'subtleforms' ),
    cta: __( 'About SubtleForms Pro', 'subtleforms' ),
    lossLine: null,
    benefits: [
      __( 'Download a PDF from the entry screen', 'subtleforms' ),
      __( 'Attach it to admin notification emails', 'subtleforms' ),
      __( 'Your logo and colours on every page', 'subtleforms' ),
    ],
  },

  'extensions.multilanguage': {
    title: __( 'Translation with WPML and Polylang', 'subtleforms' ),
    description: __( 'SubtleForms Pro lets WPML or Polylang translate form labels, messages and emails.', 'subtleforms' ),
    cta: __( 'About SubtleForms Pro', 'subtleforms' ),
    lossLine: null,
    benefits: [
      __( 'Translate labels, help text and options', 'subtleforms' ),
      __( 'Translate confirmation messages and emails', 'subtleforms' ),
      __( 'One form for every language', 'subtleforms' ),
    ],
  },
};

function getFeatureCopy( featureKey, context = {} ) {
  if ( FEATURE_COPY[ featureKey ] ) {
    return FEATURE_COPY[ featureKey ];
  }

  // Fallback: use context.label for the title when available.
  return {
    title: context.label ? context.label : __( 'SubtleForms Pro', 'subtleforms' ),
    description: __( 'This is part of SubtleForms Pro, a separate plugin.', 'subtleforms' ),
    cta: __( 'About SubtleForms Pro', 'subtleforms' ),
    lossLine: null,
    benefits: [],
  };}

// ─── Component ────────────────────────────────────────────────────────────────

export default function UpgradeModal() {
  const [ isOpen, setIsOpen ] = useState( false );
  const [ featureKey, setFeatureKey ] = useState( '' );
  const [ context, setContext ] = useState( {} );

  useEffect( () => {
    const handleUpgradeEvent = ( event ) => {
      const { featureKey: key, ...ctx } = event.detail || {};
      setFeatureKey( key || '' );
      setContext( ctx );
      setIsOpen( true );
    };

    window.addEventListener( 'sf:upgrade:required', handleUpgradeEvent );
    return () => window.removeEventListener( 'sf:upgrade:required', handleUpgradeEvent );
  }, [] );

  // White label sites never see upgrade prompts.
  if ( ! isOpen || getBranding().hideUpgrade ) {
    return null;
  }

  const copy = getFeatureCopy( featureKey, context );
  const hasProPlugin = !! window.subtleformsAdmin?.hasProPlugin;

  const outcomeList = copy.benefits.slice( 0, 3 );

  const handleUpgrade = () => {
    const url = getUpgradeUrl( featureKey || '' );
    if ( ! url ) {
      console.error( 'SubtleForms: upgrade URL could not be resolved for feature:', featureKey );
      return;
    }
    window.open( url, '_blank', 'noopener,noreferrer' );
  };

  return (
    <Modal
      className='sf-upgrade-modal'
      onRequestClose={() => setIsOpen(false)}>
      <div className='sf-upgrade-modal__card'>
        <span className='sf-upgrade-modal__hero'>
          <Icon.Crown size={14} aria-hidden='true' />
          { __( 'SubtleForms Pro', 'subtleforms' ) }
        </span>
        <h2 className='sf-upgrade-modal__title'>{copy.title}</h2>
        <p className='sf-upgrade-modal__description'>
          {copy.description}
        </p>

        {outcomeList.length > 0 && (
          <ul className='sf-upgrade-modal__benefits'>
            {outcomeList.map((item, idx) => (
              <li key={idx} className='sf-upgrade-modal__benefit'>
                <Icon.Check className='sf-upgrade-modal__benefit-icon' size={16} />
                {item}
              </li>
            ))}
          </ul>
        )}

        <div className='sf-upgrade-modal__actions'>
          { hasProPlugin ? (
            <Button
              variant='primary'
              className='sf-upgrade-modal__primary'
              href='admin.php?page=subtleforms-settings#tab=license'
              onClick={ () => setIsOpen( false ) }>
              { __( 'Activate your license', 'subtleforms' ) }
            </Button>
          ) : (
            <Button variant='primary' onClick={ handleUpgrade } className='sf-upgrade-modal__primary'>
              { copy.cta }
            </Button>
          ) }

          <Button variant='tertiary' onClick={() => setIsOpen(false)}>
            {__('Not now', 'subtleforms')}
          </Button>
        </div>

        <p className='sf-upgrade-modal__urgency'>
          { hasProPlugin
            ? __( 'SubtleForms Pro is installed. Add your license key to use it.', 'subtleforms' )
            : __( 'SubtleForms Pro is a separate plugin. Your forms and entries stay as they are.', 'subtleforms' ) }
        </p>
      </div>
    </Modal>
  );
}
