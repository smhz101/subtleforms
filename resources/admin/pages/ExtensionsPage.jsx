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
    <Card className='h-full'>
      <CardBody>
        <div className='flex flex-col h-full'>
          {/* Header */}
          <div className='flex justify-between items-start mb-4'>
            <div className='flex items-start gap-3'>
              <div className='bg-blue-50 p-3 rounded-lg'>{icon}</div>
              <div>
                <h3 className='mb-1 font-semibold text-gray-900 text-base'>
                  {title}
                </h3>
                {comingSoon && (
                  <span className='inline-flex items-center bg-yellow-50 px-2 py-0.5 rounded-full font-medium text-yellow-700 text-xs'>
                    {__('Coming Soon', 'subtleforms')}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Description */}
          <p className='mb-4 text-gray-600 text-sm'>{description}</p>

          {/* Features */}
          <div className='flex-1'>
            <ul className='space-y-2 mb-4'>
              {features.map((feature, index) => (
                <li
                  key={index}
                  className='flex items-start gap-2 text-gray-600 text-sm'>
                  <span className='mt-0.5 text-green-500'>✓</span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Action */}
          <div className='pt-4 border-gray-100 border-t'>
            <Button
              variant='secondary'
              disabled={comingSoon}
              className='justify-center w-full'>
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
      icon: <FiCreditCard className='w-6 h-6 text-blue-600' />,
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
      icon: <FiMail className='w-6 h-6 text-purple-600' />,
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
      icon: <FiUsers className='w-6 h-6 text-green-600' />,
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
      icon: <FiBarChart2 className='w-6 h-6 text-orange-600' />,
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
      icon: <FiShoppingCart className='w-6 h-6 text-red-600' />,
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
      icon: <FiFileText className='w-6 h-6 text-indigo-600' />,
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
      icon: <FiGlobe className='w-6 h-6 text-teal-600' />,
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
      icon: <FiZap className='w-6 h-6 text-yellow-600' />,
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
          <FiExternalLink className='mr-1.5 w-4 h-4' />
          {__('Browse All Extensions', 'subtleforms')}
        </Button>
      }>
      <div className='p-6'>
        {/* Info Notice */}
        <Notice status='info' isDismissible={false} className='mb-6'>
          <div className='flex items-start gap-2'>
            <FiDownloadCloud className='mt-0.5 w-5 h-5 text-blue-600' />
            <div>
              <p className='mb-1 font-medium'>
                {__('Extend SubtleForms functionality', 'subtleforms')}
              </p>
              <p className='text-sm'>
                {__(
                  'These extensions are currently in development. Sign up for early access and be notified when they become available.',
                  'subtleforms'
                )}
              </p>
            </div>
          </div>
        </Notice>

        {/* Extensions Grid */}
        <div className='gap-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3'>
          {extensions.map((extension, index) => (
            <ExtensionCard key={index} {...extension} />
          ))}
        </div>

        {/* Footer CTA */}
        <div className='bg-gradient-to-r from-blue-50 to-purple-50 mt-8 p-6 border border-blue-100 rounded-lg'>
          <div className='mx-auto max-w-2xl text-center'>
            <h3 className='mb-2 font-semibold text-gray-900 text-lg'>
              {__('Have an extension idea?', 'subtleforms')}
            </h3>
            <p className='mb-4 text-gray-600 text-sm'>
              {__(
                "We're always looking for ways to improve SubtleForms. Let us know what extensions you'd like to see!",
                'subtleforms'
              )}
            </p>
            <Button
              variant='primary'
              href='https://subtleforms.com/suggest-extension'
              target='_blank'>
              <FiExternalLink className='mr-1.5 w-4 h-4' />
              {__('Suggest an Extension', 'subtleforms')}
            </Button>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
