import { __ } from '@wordpress/i18n';
import { Card, CardBody, Button, Notice } from '@wordpress/components';
import {
  FiCreditCard,
  FiMail,
  FiUsers,
  FiBarChart2,
  FiShoppingCart,
  FiFileText,
  FiGlobe,
  FiZap,
  FiDownloadCloud,
  FiExternalLink,
} from 'react-icons/fi';
import AdminShell from '../components/AdminShell';

/**
 * Extension Card Component
 */
function ExtensionCard({ icon, title, description, features, comingSoon }) {
  return (
    <Card className='sf-h-full'>
      <CardBody>
        <div className='sf-flex sf-flex-col sf-h-full'>
          {/* Header */}
          <div className='sf-flex sf-justify-between sf-items-start sf-mb-4'>
            <div className='sf-flex sf-items-start sf-gap-3'>
              <div className='sf-bg-blue-50 sf-p-3 sf-rounded-lg'>{icon}</div>
              <div>
                <h3 className='sf-mb-1 sf-font-semibold sf-text-gray-900 sf-text-base'>
                  {title}
                </h3>
                {comingSoon && (
                  <span className='sf-inline-flex sf-items-center sf-bg-yellow-50 sf-px-2 sf-py-0.5 sf-rounded-full sf-font-medium sf-text-yellow-700 sf-text-xs'>
                    {__('Coming Soon', 'subtleforms')}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Description */}
          <p className='sf-mb-4 sf-text-gray-600 sf-text-sm'>{description}</p>

          {/* Features */}
          <div className='sf-flex-1'>
            <ul className='sf-space-y-2 sf-mb-4'>
              {features.map((feature, index) => (
                <li
                  key={index}
                  className='sf-flex sf-items-start sf-gap-2 sf-text-gray-600 sf-text-sm'>
                  <span className='sf-mt-0.5 sf-text-green-500'>✓</span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Action */}
          <div className='sf-pt-4 sf-border-gray-100 sf-border-t'>
            <Button
              variant='secondary'
              disabled={comingSoon}
              className='sf-justify-center sf-w-full'>
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
      icon: <FiCreditCard className='sf-w-6 sf-h-6 sf-text-blue-600' />,
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
      icon: <FiMail className='sf-w-6 sf-h-6 sf-text-purple-600' />,
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
      icon: <FiUsers className='sf-w-6 sf-h-6 sf-text-green-600' />,
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
      icon: <FiBarChart2 className='sf-w-6 sf-h-6 sf-text-orange-600' />,
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
      icon: <FiShoppingCart className='sf-w-6 sf-h-6 sf-text-red-600' />,
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
      icon: <FiFileText className='sf-w-6 sf-h-6 sf-text-indigo-600' />,
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
      icon: <FiGlobe className='sf-w-6 sf-h-6 sf-text-teal-600' />,
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
      icon: <FiZap className='sf-w-6 sf-h-6 sf-text-yellow-600' />,
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
          <FiExternalLink className='sf-mr-1.5 sf-w-4 sf-h-4' />
          {__('Browse All Extensions', 'subtleforms')}
        </Button>
      }>
      <div className='sf-p-6'>
        {/* Info Notice */}
        <Notice status='info' isDismissible={false} className='sf-mb-6'>
          <div className='sf-flex sf-items-start sf-gap-2'>
            <FiDownloadCloud className='sf-mt-0.5 sf-w-5 sf-h-5 sf-text-blue-600' />
            <div>
              <p className='sf-mb-1 sf-font-medium'>
                {__('Extend SubtleForms functionality', 'subtleforms')}
              </p>
              <p className='sf-text-sm'>
                {__(
                  'These extensions are currently in development. Sign up for early access and be notified when they become available.',
                  'subtleforms'
                )}
              </p>
            </div>
          </div>
        </Notice>

        {/* Extensions Grid */}
        <div className='sf-gap-6 sf-grid sf-grid-cols-1 md:sf-grid-cols-2 lg:sf-grid-cols-3'>
          {extensions.map((extension, index) => (
            <ExtensionCard key={index} {...extension} />
          ))}
        </div>

        {/* Footer CTA */}
        <div className='sf-bg-gradient-to-r sf-from-blue-50 sf-to-purple-50 sf-mt-8 sf-p-6 sf-border sf-border-blue-100 sf-rounded-lg'>
          <div className='sf-mx-auto sf-max-w-2xl sf-text-center'>
            <h3 className='sf-mb-2 sf-font-semibold sf-text-gray-900 sf-text-lg'>
              {__('Have an extension idea?', 'subtleforms')}
            </h3>
            <p className='sf-mb-4 sf-text-gray-600 sf-text-sm'>
              {__(
                "We're always looking for ways to improve SubtleForms. Let us know what extensions you'd like to see!",
                'subtleforms'
              )}
            </p>
            <Button
              variant='primary'
              href='https://subtleforms.com/suggest-extension'
              target='_blank'>
              <FiExternalLink className='sf-mr-1.5 sf-w-4 sf-h-4' />
              {__('Suggest an Extension', 'subtleforms')}
            </Button>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
