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
import { getBranding } from '../utils/branding';
import './UpgradeModal.scss';

// ─── Feature copy table ───────────────────────────────────────────────────────
// Keys should match the capability / context keys used when calling requirePro().

const FEATURE_COPY = {
  'fields.advanced': {
    title: __( 'Smarter fields with Pro', 'subtleforms' ),
    description: __( 'Picture Choice, Signature, live Calculations and multi-file uploads, in the same builder you already use.', 'subtleforms' ),
    cta: __( 'Unlock Pro fields', 'subtleforms' ),
    lossLine: null,
    benefits: [
      __( 'Picture Choice with image options and multi-select', 'subtleforms' ),
      __( 'Signature pad that works on touch screens', 'subtleforms' ),
      __( 'Calculations with a formula builder, checked again on the server', 'subtleforms' ),
    ],
  },

  'logic.conditional.advanced': {
    title: __( 'Advanced conditional logic', 'subtleforms' ),
    description: __( 'Build forms that adapt to each answer: richer rules for fields, steps, emails and confirmations.', 'subtleforms' ),
    cta: __( 'Unlock advanced logic', 'subtleforms' ),
    lossLine: null,
    benefits: [
      __( 'Match all or any rule, and combine groups of rules', 'subtleforms' ),
      __( 'Starts with, ends with, is one of, between and date rules', 'subtleforms' ),
      __( 'Skip steps, send emails and pick confirmations based on answers', 'subtleforms' ),
    ],
  },

  'branding.white_label': {
    title: __( 'White label for client sites', 'subtleforms' ),
    description: __( 'Show your agency’s name and logo in the forms admin and hide SubtleForms links and prompts. Included in the Agency plan.', 'subtleforms' ),
    cta: __( 'See the Agency plan', 'subtleforms' ),
    lossLine: null,
    benefits: [
      __( 'Your plugin name in the admin menu and header', 'subtleforms' ),
      __( 'Your logo from the Media Library', 'subtleforms' ),
      __( 'No SubtleForms help links, credits or upgrade prompts', 'subtleforms' ),
    ],
  },

  'templates.pro': {
    title: __( 'Pro templates', 'subtleforms' ),
    description: __( 'Start from proven layouts for registrations, orders, applications and support, then make them yours.', 'subtleforms' ),
    cta: __( 'Unlock all templates', 'subtleforms' ),
    lossLine: null,
    benefits: [
      __( 'Multi-step, conversational and payment-ready layouts', 'subtleforms' ),
      __( 'Every field and setting stays fully editable', 'subtleforms' ),
      __( 'New templates added with updates', 'subtleforms' ),
    ],
  },

  'submissions.export': {
    title: __( 'Export Your Submissions', 'subtleforms' ),
    description: __( 'Your submissions are collecting dust inside SubtleForms. Export them to see the data, spot patterns, and put it to work.', 'subtleforms' ),
    cta: __( 'Unlock CSV Export', 'subtleforms' ),
    lossLine: __( 'Your data is currently trapped inside SubtleForms.', 'subtleforms' ),
    benefits: [
      __( 'Stop copying submissions into spreadsheets by hand', 'subtleforms' ),
      __( 'Analyse your data in Excel, Google Sheets, or any CRM', 'subtleforms' ),
      __( 'Filter by form, status or start date before you download', 'subtleforms' ),
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
      __( 'Build automations in minutes, no code required', 'subtleforms' ),
    ],
  },

  'extensions.email_marketing': {
    title: __( 'Grow Your Email List', 'subtleforms' ),
    description: __( 'Every form respondent is a potential subscriber. Without this, they complete the form and leave, nothing captured.', 'subtleforms' ),
    cta: __( 'Grow My Email List', 'subtleforms' ),
    lossLine: __( 'You are missing a subscriber with every form submission.', 'subtleforms' ),
    benefits: [
      __( 'Every respondent is automatically added to your email list', 'subtleforms' ),
      __( 'Stop losing potential subscribers to manual imports', 'subtleforms' ),
      __( 'Works with Mailchimp, Brevo and Kit, with tags and consent checks', 'subtleforms' ),
    ],
  },

  'extensions.crm': {
    title: __( 'Sync Leads to Your CRM', 'subtleforms' ),
    description: __( 'Without CRM sync, every lead sits in your submissions list, unseen by your sales team until someone copies it across.', 'subtleforms' ),
    cta: __( 'Start Syncing Leads', 'subtleforms' ),
    lossLine: __( 'Leads from your forms are not reaching your CRM.', 'subtleforms' ),
    benefits: [
      __( 'Every form fill becomes a CRM contact, no copy-paste', 'subtleforms' ),
      __( 'Stop losing leads between your forms and your sales pipeline', 'subtleforms' ),
      __( 'HubSpot built in, or any CRM through Zapier or Make', 'subtleforms' ),
    ],
  },

  'extensions.analytics': {
    title: __( 'Track Form Performance', 'subtleforms' ),
    description: __( 'Without analytics, you have no idea which forms convert and which ones lose people. You are optimising blind.', 'subtleforms' ),
    cta: __( 'Track My Conversions', 'subtleforms' ),
    lossLine: __( 'You have no visibility into which forms are actually converting.', 'subtleforms' ),
    benefits: [
      __( 'See exactly which forms convert, and which ones lose people', 'subtleforms' ),
      __( 'Stop guessing and start optimising with real submission data', 'subtleforms' ),
      __( 'Views, submissions and conversion rate on the Forms list and Dashboard', 'subtleforms' ),
    ],
  },

  'extensions.ecommerce': {
    title: __( 'Sell with Your Forms', 'subtleforms' ),
    description: __( 'Every time a buyer reaches your form and leaves without buying, that sale is gone. Convert them here, when intent is highest.', 'subtleforms' ),
    cta: __( 'Start Selling with Forms', 'subtleforms' ),
    lossLine: __( 'You are sending buyers away to checkout instead of converting them here.', 'subtleforms' ),
    benefits: [
      __( 'Accept orders directly inside your forms, no separate shop needed', 'subtleforms' ),
      __( 'Add product selections, quantities, and checkout in minutes', 'subtleforms' ),
      __( 'Stop losing buyers to a separate, clunky checkout flow', 'subtleforms' ),
    ],
  },

  'extensions.pdf': {
    title: __( 'PDF Copies of Every Entry', 'subtleforms' ),
    description: __( 'Without this, every receipt, report, or confirmation has to be created manually. That time adds up fast.', 'subtleforms' ),
    cta: __( 'Automate My PDFs', 'subtleforms' ),
    lossLine: __( 'You are creating documents manually that could be generated automatically.', 'subtleforms' ),
    benefits: [
      __( 'Download any entry as a branded PDF with one click', 'subtleforms' ),
      __( 'Attach the PDF to your notification emails automatically', 'subtleforms' ),
      __( 'Order summaries included for payment forms', 'subtleforms' ),
    ],
  },

  'extensions.multilanguage': {
    title: __( 'Reach a Global Audience', 'subtleforms' ),
    description: __( 'Visitors who see your form in the wrong language leave. Every international visitor you lose is a submission you will never get back.', 'subtleforms' ),
    cta: __( 'Reach a Global Audience', 'subtleforms' ),
    lossLine: __( 'International visitors are seeing your forms in the wrong language.', 'subtleforms' ),
    benefits: [
      __( 'Show your forms in each visitor’s language automatically', 'subtleforms' ),
      __( 'Stop losing international visitors to a language barrier', 'subtleforms' ),
      __( 'Works with WPML and Polylang out of the box', 'subtleforms' ),
    ],
  },

  'extensions.payments': {
    title: __( 'Collect Payments in Your Forms', 'subtleforms' ),
    description: __( 'Your forms already capture intent. Adding payments converts that intent into revenue, without a separate checkout page.', 'subtleforms' ),
    cta: __( 'Start Collecting Payments', 'subtleforms' ),
    lossLine: __( 'You are leaving revenue on the table with every form submission.', 'subtleforms' ),
    benefits: [
      __( 'Collect one-time card payments directly inside your forms', 'subtleforms' ),
      __( 'Stop redirecting buyers away to a separate payment page', 'subtleforms' ),
      __( 'Stripe cards, Apple Pay and Google Pay, with coupons and order totals', 'subtleforms' ),
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
      __( 'Everything you need, in the same place you build forms', 'subtleforms' ),
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

  // White label sites never see upgrade prompts.
  if ( ! isOpen || getBranding().hideUpgrade ) {
    return null;
  }

  const copy = getFeatureCopy( featureKey, context );
  const hasProPlugin = !! window.subtleformsAdmin?.hasProPlugin;

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
        <span className='sf-upgrade-modal__hero'>
          <Icon.Crown size={14} aria-hidden='true' />
          { __( 'SubtleForms Pro', 'subtleforms' ) }
        </span>
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
              { copy.cta || __( 'Upgrade to Pro', 'subtleforms' ) }
            </Button>
          ) }

          <Button variant='tertiary' onClick={() => setIsOpen(false)}>
            {__('Not now', 'subtleforms')}
          </Button>
        </div>

        <p className='sf-upgrade-modal__urgency'>
          { hasProPlugin
            ? __( 'SubtleForms Pro is installed. It switches on as soon as your key is active.', 'subtleforms' )
            : __( 'Pro is an add-on. Your forms and entries stay exactly as they are.', 'subtleforms' ) }
        </p>
      </div>
    </Modal>
  );
}
