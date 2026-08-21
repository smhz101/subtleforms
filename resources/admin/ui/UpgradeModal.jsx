/**
 * UpgradeModal — Global event-driven Pro upgrade modal.
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
import './UpgradeModal.scss';

// ─── Feature copy table ───────────────────────────────────────────────────────
// Keys should match the capability / context keys used when calling requirePro().

const FEATURE_COPY = {
  'submissions.export': {
    title: __( 'Export Your Submissions', 'subtleforms' ),
    description: __( 'Your submissions are collecting dust inside SubtleForms. Export them to see the data, spot patterns, and put it to work.', 'subtleforms' ),
    cta: __( 'Unlock CSV Export', 'subtleforms' ),
    lossLine: __( 'Your data is currently trapped inside SubtleForms.', 'subtleforms' ),
    benefits: [
      __( 'Stop copying submissions into spreadsheets by hand', 'subtleforms' ),
      __( 'Analyse your data in Excel, Google Sheets, or any CRM', 'subtleforms' ),
      __( 'Filter by form, date range, or status before you download', 'subtleforms' ),
    ],
  },

  'actions.payment': {
    title: __( 'Accept Payments', 'subtleforms' ),
    description: __( 'Stop sending buyers to a separate checkout page. Add payments directly to your forms and convert while intent is highest.', 'subtleforms' ),
    cta: __( 'Start Accepting Payments', 'subtleforms' ),
    lossLine: __( 'You are leaving revenue on the table with every form submission.', 'subtleforms' ),
    benefits: [
      __( 'Start collecting revenue without building a separate checkout', 'subtleforms' ),
      __( 'Add pricing fields, coupons, and order summaries to any form', 'subtleforms' ),
      __( 'Payments go live the moment you publish your form', 'subtleforms' ),
    ],
  },

  'extensions.webhooks': {
    title: __( 'Send Data Anywhere with Webhooks', 'subtleforms' ),
    description: __( 'Every submission sits idle until you manually move it. Webhooks send it to the right place the instant it arrives.', 'subtleforms' ),
    cta: __( 'Unlock Webhooks', 'subtleforms' ),
    lossLine: __( 'Submissions are not reaching your other tools in real time.', 'subtleforms' ),
    benefits: [
      __( 'Every submission instantly reaches Zapier, Make, or your own endpoint', 'subtleforms' ),
      __( 'Stop manually moving data between your tools', 'subtleforms' ),
      __( 'Build automations in minutes — no code required', 'subtleforms' ),
    ],
  },

  'extensions.email_marketing': {
    title: __( 'Grow Your Email List', 'subtleforms' ),
    description: __( 'Every form respondent is a potential subscriber. Without this, they complete the form and leave — nothing captured.', 'subtleforms' ),
    cta: __( 'Grow My Email List', 'subtleforms' ),
    lossLine: __( 'You are missing a subscriber with every form submission.', 'subtleforms' ),
    benefits: [
      __( 'Every respondent is automatically added to your email list', 'subtleforms' ),
      __( 'Stop losing potential subscribers to manual imports', 'subtleforms' ),
      __( 'Trigger welcome sequences the moment someone submits', 'subtleforms' ),
    ],
  },

  'extensions.crm': {
    title: __( 'Sync Leads to Your CRM', 'subtleforms' ),
    description: __( 'Without CRM sync, every lead sits in your submissions list — unseen by your sales team until someone copies it across.', 'subtleforms' ),
    cta: __( 'Start Syncing Leads', 'subtleforms' ),
    lossLine: __( 'Leads from your forms are not reaching your CRM.', 'subtleforms' ),
    benefits: [
      __( 'Every form fill becomes a CRM contact — no copy-paste', 'subtleforms' ),
      __( 'Stop losing leads between your forms and your sales pipeline', 'subtleforms' ),
      __( 'Map any form field to CRM properties in minutes', 'subtleforms' ),
    ],
  },

  'extensions.analytics': {
    title: __( 'Track Form Performance', 'subtleforms' ),
    description: __( 'Without analytics, you have no idea which forms convert and which ones lose people. You are optimising blind.', 'subtleforms' ),
    cta: __( 'Track My Conversions', 'subtleforms' ),
    lossLine: __( 'You have no visibility into which forms are actually converting.', 'subtleforms' ),
    benefits: [
      __( 'See exactly which forms convert — and which ones lose people', 'subtleforms' ),
      __( 'Stop guessing and start optimising with real submission data', 'subtleforms' ),
      __( 'Send form events to Google Analytics and Meta Pixel automatically', 'subtleforms' ),
    ],
  },

  'extensions.ecommerce': {
    title: __( 'Sell with Your Forms', 'subtleforms' ),
    description: __( 'Every time a buyer reaches your form and leaves without buying, that sale is gone. Convert them here — when intent is highest.', 'subtleforms' ),
    cta: __( 'Start Selling with Forms', 'subtleforms' ),
    lossLine: __( 'You are sending buyers away to checkout instead of converting them here.', 'subtleforms' ),
    benefits: [
      __( 'Accept orders directly inside your forms — no separate shop needed', 'subtleforms' ),
      __( 'Add product selections, quantities, and checkout in minutes', 'subtleforms' ),
      __( 'Stop losing buyers to a separate, clunky checkout flow', 'subtleforms' ),
    ],
  },

  'extensions.pdf': {
    title: __( 'Generate PDF Receipts & Reports', 'subtleforms' ),
    description: __( 'Without this, every receipt, report, or confirmation has to be created manually. That time adds up fast.', 'subtleforms' ),
    cta: __( 'Automate My PDFs', 'subtleforms' ),
    lossLine: __( 'You are creating documents manually that could be generated automatically.', 'subtleforms' ),
    benefits: [
      __( 'Every submission generates a branded PDF automatically', 'subtleforms' ),
      __( 'Stop manually creating receipts, reports, and confirmations', 'subtleforms' ),
      __( 'Respondents receive professional PDFs without any extra work from you', 'subtleforms' ),
    ],
  },

  'extensions.multilanguage': {
    title: __( 'Reach a Global Audience', 'subtleforms' ),
    description: __( 'Visitors who see your form in the wrong language leave. Every international visitor you lose is a submission you will never get back.', 'subtleforms' ),
    cta: __( 'Reach a Global Audience', 'subtleforms' ),
    lossLine: __( 'International visitors are seeing your forms in the wrong language.', 'subtleforms' ),
    benefits: [
      __( 'Show your forms in each visitor\'s language — automatically', 'subtleforms' ),
      __( 'Stop losing international visitors to a language barrier', 'subtleforms' ),
      __( 'Works with WPML and Polylang out of the box', 'subtleforms' ),
    ],
  },

  'extensions.payments': {
    title: __( 'Collect Payments in Your Forms', 'subtleforms' ),
    description: __( 'Your forms already capture intent. Adding payments converts that intent into revenue — without a separate checkout page.', 'subtleforms' ),
    cta: __( 'Start Collecting Payments', 'subtleforms' ),
    lossLine: __( 'You are leaving revenue on the table with every form submission.', 'subtleforms' ),
    benefits: [
      __( 'Collect one-time and recurring payments directly inside your forms', 'subtleforms' ),
      __( 'Stop redirecting buyers away to a separate payment page', 'subtleforms' ),
      __( 'Stripe and PayPal supported — go live today', 'subtleforms' ),
    ],
  },
};

// ─── Copy resolver ────────────────────────────────────────────────────────────

function getFeatureCopy( featureKey, context = {} ) {
  if ( FEATURE_COPY[ featureKey ] ) {
    return FEATURE_COPY[ featureKey ];
  }

  // Fallback: use context.label for a personalised title when available
  return {
    title: context.label
      ? context.label
      : __( 'Unlock Premium Features', 'subtleforms' ),
    description: __( 'Upgrade to SubtleForms Pro to unlock this and all other Pro features.', 'subtleforms' ),
    cta: __( 'Upgrade to Pro', 'subtleforms' ),
    lossLine: null,
    benefits: [
      __( 'Stop using tools that don\'t connect to your forms', 'subtleforms' ),
      __( 'Everything you need — in the same place you build forms', 'subtleforms' ),
      __( 'Unlock all Pro extensions and capabilities immediately', 'subtleforms' ),
    ],
  };
}

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

  if ( ! isOpen ) {
    return null;
  }

  const copy = getFeatureCopy( featureKey, context );

  const outcomeList = copy.benefits.slice(0, 3).map((item, index) => {
    // convert feature-style text to outcome-style, keep simple fallback
    return item;
  });

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
        <div className='sf-upgrade-modal__hero'>
          <Icon.Sparkles size={24} />
        </div>
        <h2 className='sf-upgrade-modal__title'>{copy.title || __('Unlock Premium Features', 'subtleforms')}</h2>
        <p className='sf-upgrade-modal__description'>
          {copy.description || __('Upgrade to SubtleForms Pro for a premium workflow experience.', 'subtleforms')}
        </p>

        <ul className='sf-upgrade-modal__benefits'>
          {outcomeList.map((item, idx) => (
            <li key={idx} className='sf-upgrade-modal__benefit'>
              <Icon.Check className='sf-upgrade-modal__benefit-icon' size={16} />
              {item}
            </li>
          ))}
        </ul>

        {copy.lossLine && (
          <p className='sf-upgrade-modal__loss'>{copy.lossLine}</p>
        )}

        <div className='sf-upgrade-modal__actions'>
          <Button variant='primary' onClick={handleUpgrade} className='sf-upgrade-modal__primary'>
            {copy.cta || __('Upgrade to Pro', 'subtleforms')}
          </Button>

          <Button variant='tertiary' onClick={() => setIsOpen(false)}>
            {__('Continue with Free', 'subtleforms')}
          </Button>
        </div>

        <p className='sf-upgrade-modal__urgency'>
          <Icon.Users size={13} />
          {__('Used by teams to streamline workflows', 'subtleforms')}
        </p>
      </div>
    </Modal>
  );
}
