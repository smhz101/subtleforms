import { __ } from '@wordpress/i18n';
import { Card, CardBody, Button, Notice } from '@wordpress/components';
import Icon from '../components/ui/Icon';
import AdminShell from '../components/AdminShell';
import './ExtensionsPage.scss';

/**
 * Extension Card Component
 */
function ExtensionCard({ icon, title, description, features, comingSoon }) {
  return (
    <Card className='sf-ext-card'>
      <CardBody>
        <div className='sf-ext-card-content'>
          {/* Header */}
          <div className='sf-ext-header'>
            <div className='sf-ext-header-left'>
              <div className='sf-ext-icon'>{icon}</div>
              <div>
                <h3 className='sf-ext-card__title'>{title}</h3>
                {comingSoon && (
                  <span className='sf-ext-card__badge'>
                    {__('Coming Soon', 'subtleforms')}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Description */}
          <p className='sf-ext-card__description'>{description}</p>

          {/* Features */}
          <div className='sf-ext-card__features'>
            <ul className='sf-ext-card__features-list'>
              {features.map((feature, index) => (
                <li key={index} className='sf-ext-card__feature-item'>
                  <span className='sf-ext-card__feature-check'>✓</span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Action */}
          <div className='sf-ext-card__action'>
            <Button
              variant='secondary'
              disabled={comingSoon}
              className='sf-ext-card__install-btn'>
              {comingSoon
                ? __('Coming Soon', 'subtleforms')
                : __('Install', 'subtleforms')}
            </Button>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

/**
 * Extensions Page Component
 */
export default function ExtensionsPage() {
  const extensions = [
    {
      icon: <Icon.CreditCard className='sf-ext-icon__svg sf-icon--blue' />,
      title: __('Payment Gateway Integration', 'subtleforms'),
      description: __(
        'Accept payments directly through your forms with support for popular payment processors.',
        'subtleforms'
      ),
      features: [
        __('Stripe integration', 'subtleforms'),
        __('PayPal support', 'subtleforms'),
        __('One-time and recurring payments', 'subtleforms'),
        __('Secure payment processing', 'subtleforms'),
      ],
      comingSoon: true,
    },
    {
      icon: <Icon.Mail className='sf-ext-icon__svg sf-icon--purple' />,
      title: __('Email Marketing', 'subtleforms'),
      description: __(
        'Automatically sync form submissions with your favorite email marketing services.',
        'subtleforms'
      ),
      features: [
        __('Mailchimp integration', 'subtleforms'),
        __('ConvertKit support', 'subtleforms'),
        __('Automatic list syncing', 'subtleforms'),
        __('Custom field mapping', 'subtleforms'),
      ],
      comingSoon: true,
    },
    {
      icon: <Icon.Users className='sf-ext-icon__svg sf-icon--green' />,
      title: __('CRM Integration', 'subtleforms'),
      description: __(
        'Send form data directly to your CRM and keep your contacts organized and up-to-date.',
        'subtleforms'
      ),
      features: [
        __('Salesforce integration', 'subtleforms'),
        __('HubSpot support', 'subtleforms'),
        __('Real-time data sync', 'subtleforms'),
        __('Custom object mapping', 'subtleforms'),
      ],
      comingSoon: true,
    },
    {
      icon: <Icon.BarChart2 className='sf-ext-icon__svg sf-icon--orange' />,
      title: __('Advanced Analytics', 'subtleforms'),
      description: __(
        'Get detailed insights into form performance with advanced analytics and reporting.',
        'subtleforms'
      ),
      features: [
        __('Conversion tracking', 'subtleforms'),
        __('Detailed reports', 'subtleforms'),
        __('Field analytics', 'subtleforms'),
        __('Export capabilities', 'subtleforms'),
      ],
      comingSoon: true,
    },
    {
      icon: <Icon.ShoppingCart className='sf-ext-icon__svg sf-icon--red' />,
      title: __('E-commerce Integration', 'subtleforms'),
      description: __(
        'Connect your forms with WooCommerce and other e-commerce platforms.',
        'subtleforms'
      ),
      features: [
        __('WooCommerce integration', 'subtleforms'),
        __('Product selection fields', 'subtleforms'),
        __('Order form creation', 'subtleforms'),
        __('Cart abandonment tracking', 'subtleforms'),
      ],
      comingSoon: true,
    },
    {
      icon: <Icon.FileText className='sf-ext-icon__svg sf-icon--indigo' />,
      title: __('Document Generation', 'subtleforms'),
      description: __(
        'Automatically generate PDF documents from form submissions with custom templates.',
        'subtleforms'
      ),
      features: [
        __('PDF generation', 'subtleforms'),
        __('Custom templates', 'subtleforms'),
        __('Digital signatures', 'subtleforms'),
        __('Email attachments', 'subtleforms'),
      ],
      comingSoon: true,
    },
    {
      icon: <Icon.Globe className='sf-ext-icon__svg sf-icon--teal' />,
      title: __('Multi-language Support', 'subtleforms'),
      description: __(
        'Create multilingual forms with automatic translation and language detection.',
        'subtleforms'
      ),
      features: [
        __('WPML integration', 'subtleforms'),
        __('Polylang support', 'subtleforms'),
        __('RTL language support', 'subtleforms'),
        __('Translation management', 'subtleforms'),
      ],
      comingSoon: true,
    },
    {
      icon: <Icon.Zap className='sf-ext-icon__svg sf-icon--yellow' />,
      title: __('Automation & Webhooks', 'subtleforms'),
      description: __(
        'Automate workflows and connect with thousands of apps using webhooks and Zapier.',
        'subtleforms'
      ),
      features: [
        __('Zapier integration', 'subtleforms'),
        __('Custom webhooks', 'subtleforms'),
        __('Conditional logic', 'subtleforms'),
        __('Real-time triggers', 'subtleforms'),
      ],
      comingSoon: true,
    },
  ];

  return (
    <AdminShell
      title={__('Extensions', 'subtleforms')}
      actions={
        <Button
          variant='secondary'
          href='https://subtleforms.com/extensions'
          target='_blank'>
          <Icon.ExternalLink className='sf-button-icon' />
          {__('Browse All Extensions', 'subtleforms')}
        </Button>
      }>
      <div className='sf-extensions-page__content'>
        {/* Info Notice */}
        <Notice
          status='info'
          isDismissible={false}
          className='sf-extensions-page__notice'>
          <div className='sf-extensions-page__notice-content'>
            <Icon.DownloadCloud className='sf-extensions-page__notice-icon' />
            <div>
              <p className='sf-extensions-page__notice-title'>
                {__('Extend SubtleForms functionality', 'subtleforms')}
              </p>
              <p className='sf-extensions-page__notice-desc'>
                {__(
                  'These extensions are currently in development. Sign up for early access and be notified when they become available.',
                  'subtleforms'
                )}
              </p>
            </div>
          </div>
        </Notice>

        {/* Extensions Grid */}
        <div className='sf-ext-grid'>
          {extensions.map((extension, index) => (
            <ExtensionCard key={index} {...extension} />
          ))}
        </div>

        {/* Footer CTA */}
        <div className='sf-extensions-page__cta'>
          <div className='sf-extensions-page__cta-content'>
            <h3 className='sf-extensions-page__cta-title'>
              {__('Have an extension idea?', 'subtleforms')}
            </h3>
            <p className='sf-extensions-page__cta-desc'>
              {__(
                "We're always looking for ways to improve SubtleForms. Let us know what extensions you'd like to see!",
                'subtleforms'
              )}
            </p>
            <Button
              variant='primary'
              href='https://subtleforms.com/suggest-extension'
              target='_blank'>
              <Icon.ExternalLink className='sf-button-icon' />
              {__('Suggest an Extension', 'subtleforms')}
            </Button>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
