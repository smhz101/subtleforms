import { Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import AdminShell from '../components/AdminShell';
import Icon from '../ui/Icon';
import './UpgradePage.scss';

/** What SubtleForms Pro adds. Plain statements, in the order people ask about them. */
function features() {
  return [
    {
      key: 'fields',
      icon: Icon.Layers,
      title: __('Fields', 'subtleforms'),
      text: __('Signature, Calculation and Picture choice fields, and several files per upload field.', 'subtleforms'),
    },
    {
      key: 'payments',
      icon: Icon.CreditCard,
      title: __('Payments', 'subtleforms'),
      text: __('Take payments with Stripe, with coupons, an order summary and an Orders screen.', 'subtleforms'),
    },
    {
      key: 'crm',
      icon: Icon.Users,
      title: __('CRM', 'subtleforms'),
      text: __('Send entries to HubSpot, Salesforce, Pipedrive and Close.', 'subtleforms'),
    },
    {
      key: 'automation',
      icon: Icon.Zap,
      title: __('Automation', 'subtleforms'),
      text: __('Connect forms to Zapier, Make and n8n.', 'subtleforms'),
    },
    {
      key: 'analytics',
      icon: Icon.BarChart2,
      title: __('Analytics', 'subtleforms'),
      text: __('Views, submissions and conversion rate for each form.', 'subtleforms'),
    },
    {
      key: 'mcp',
      icon: Icon.Bot,
      title: __('MCP', 'subtleforms'),
      text: __('An MCP server, so the AI assistants you connect can work with your forms.', 'subtleforms'),
    },
    {
      key: 'pdf',
      icon: Icon.FileText,
      title: __('PDF', 'subtleforms'),
      text: __('Download an entry as a PDF, or attach it to the notification email.', 'subtleforms'),
    },
    {
      key: 'woocommerce',
      icon: Icon.ShoppingCart,
      title: __('WooCommerce', 'subtleforms'),
      text: __('Send a payment form to the WooCommerce checkout.', 'subtleforms'),
    },
    {
      key: 'translation',
      icon: Icon.Globe,
      title: __('Translation', 'subtleforms'),
      text: __('Register form text with WPML or Polylang and show each visitor their language.', 'subtleforms'),
    },
  ];
}

/**
 * The upgrade page: what the separate SubtleForms Pro plugin adds,
 * and one link to its page. Information only: nothing in this plugin depends
 * on it, and the menu item is left out once an add-on is installed.
 *
 * @param {Object} props
 * @param {string} props.url Address of the Pro page (tests); read from the page when omitted.
 */
export default function UpgradePage({ url }) {
  const href = url || window.subtleformsAdmin?.upgradeUrl || 'https://subtleforms.com/pro/';

  return (
    <AdminShell
      title={__('SubtleForms Pro', 'subtleforms')}
      description={__(
        'SubtleForms Pro is a separate plugin. Everything in SubtleForms keeps working without it.',
        'subtleforms'
      )}
      actions={
        <Button variant='primary' href={href} target='_blank' rel='noopener noreferrer'>
          {__('About SubtleForms Pro', 'subtleforms')}
          <span className='screen-reader-text'> {__('(opens in a new tab)', 'subtleforms')}</span>
        </Button>
      }>
      <div className='sf-upgrade'>
        <h2 className='sf-upgrade__heading'>{__('What Pro adds', 'subtleforms')}</h2>
        <ul className='sf-upgrade__grid'>
          {features().map((feature) => {
            const FeatureIcon = feature.icon;
            return (
              <li key={feature.key} className='sf-upgrade__item'>
                <span className='sf-upgrade__icon' aria-hidden='true'>
                  <FeatureIcon size={18} />
                </span>
                <div>
                  <h3 className='sf-upgrade__title'>{feature.title}</h3>
                  <p className='sf-upgrade__text'>{feature.text}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </AdminShell>
  );
}
