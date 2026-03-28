import { __ } from '@wordpress/i18n';
import { Button } from '@wordpress/components';
import Icon from '../components/ui/Icon';
import AdminShell from '../components/AdminShell';
import { requirePro } from '../utils/featureGate';
import './ExtensionsPage.scss';

// Map extension slugs to icon components + accent colours
const EXT_META = {
  webhooks:        { icon: Icon.Zap,          color: 'yellow' },
  email_marketing: { icon: Icon.Mail,         color: 'purple' },
  crm:             { icon: Icon.Users,        color: 'green'  },
  analytics:       { icon: Icon.BarChart2,    color: 'orange' },
  ecommerce:       { icon: Icon.ShoppingCart, color: 'red'    },
  pdf:             { icon: Icon.FileText,     color: 'indigo' },
  multilanguage:   { icon: Icon.Globe,        color: 'teal'   },
  payments:        { icon: Icon.CreditCard,   color: 'blue'   },
};

// Per-extension outcome lines — shown below the card title
const EXT_SUBDESC = {
  webhooks:        __( 'Send data anywhere, the instant a form is submitted', 'subtleforms' ),
  email_marketing: __( 'Grow your email list automatically', 'subtleforms' ),
  crm:             __( 'Turn every form submission into a sales pipeline lead', 'subtleforms' ),
  analytics:       __( 'Track which forms actually convert', 'subtleforms' ),
  ecommerce:       __( 'Sell products and take orders directly in your forms', 'subtleforms' ),
  pdf:             __( 'Generate professional PDFs from every submission', 'subtleforms' ),
  multilanguage:   __( 'Reach users in their own language', 'subtleforms' ),
  payments:        __( 'Accept payments directly from your forms', 'subtleforms' ),
};

// Ordered display list
const EXT_ORDER = [
  'webhooks', 'email_marketing', 'crm', 'analytics',
  'ecommerce', 'pdf', 'multilanguage', 'payments',
];

/**
 * Status badge for each extension card.
 */
function StatusBadge({ ext }) {
  if (!ext.available) {
    return <span className='sf-ext-badge sf-ext-badge--pro'>{__('Pro', 'subtleforms')}</span>;
  }
  if (ext.enabled && ext.configured) {
    return <span className='sf-ext-badge sf-ext-badge--active'>{__('Active', 'subtleforms')}</span>;
  }
  if (ext.enabled) {
    return <span className='sf-ext-badge sf-ext-badge--setup'>{__('Needs Setup', 'subtleforms')}</span>;
  }
  return <span className='sf-ext-badge sf-ext-badge--inactive'>{__('Inactive', 'subtleforms')}</span>;
}

/**
 * Single extension card.
 */
function ExtensionCard({ ext }) {
  const meta    = EXT_META[ext.slug] ?? { icon: Icon.Zap, color: 'gray' };
  const IconCmp = meta.icon;

  // Navigate to Settings > Extensions tab with the correct slug pre-selected
  const settingsUrl = `${window.location.pathname}?page=subtleforms-settings&tab=extensions&ext=${ext.slug}`;

  return (
    <div className={`sf-ext-card sf-ext-card--${ext.available ? 'available' : 'locked'}`}>
      <div className='sf-ext-card__body'>
        {/* Header */}
        <div className='sf-ext-card__head'>
          <div className={`sf-ext-card__icon sf-ext-card__icon--${meta.color}`}>
            <IconCmp className='sf-ext-card__icon-svg' />
          </div>
          <StatusBadge ext={ext} />
        </div>

        {/* Info */}
        <h3 className='sf-ext-card__title'>{ext.label}</h3>
        <p className='sf-ext-card__subdesc'>{EXT_SUBDESC[ext.slug] || ''}</p>
        <p className='sf-ext-card__desc'>{ext.description}</p>
      </div>

      {/* Footer action */}
      <div className='sf-ext-card__footer'>
        {ext.available ? (
          <Button
            variant='secondary'
            className='sf-ext-card__btn'
            href={settingsUrl}>
            {ext.enabled
              ? __('Configure', 'subtleforms')
              : __('Set Up', 'subtleforms')}
          </Button>
        ) : (
          <Button
            variant='secondary'
            className='sf-ext-card__btn sf-ext-card__btn--unlock'
            onClick={() => requirePro(
              `extensions.${ext.slug}`,
              () => {},
              { label: ext.label }
            )}>
            <Icon.Lock size={13} />
            {__('Unlock', 'subtleforms')}
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Extensions Page — shows real-time extension status from the backend.
 */
export default function ExtensionsPage() {
  const rawExtensions = window.subtleformsAdmin?.extensions ?? {};
  const hasProPlugin  = !!window.subtleformsAdmin?.hasProPlugin;

  // Build ordered list
  const extensions = EXT_ORDER
    .filter((slug) => rawExtensions[slug])
    .map((slug) => rawExtensions[slug]);

  const activeCount = extensions.filter((e) => e.enabled && e.available).length;

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

        {/* Summary bar */}
        <div className='sf-ext-summary'>
          <div className='sf-ext-summary__stat'>
            <span className='sf-ext-summary__num'>{extensions.length}</span>
            <span className='sf-ext-summary__label'>{__('Available', 'subtleforms')}</span>
          </div>
          <div className='sf-ext-summary__divider' />
          <div className='sf-ext-summary__stat'>
            <span className={`sf-ext-summary__num ${activeCount > 0 ? 'sf-ext-summary__num--active' : ''}`}>
              {activeCount}
            </span>
            <span className='sf-ext-summary__label'>{__('Active', 'subtleforms')}</span>
          </div>
          {!hasProPlugin && (
            <>
              <div className='sf-ext-summary__divider' />
              <a
                href='https://subtleforms.com/pro'
                target='_blank'
                rel='noreferrer'
                className='sf-ext-summary__upgrade'>
                <Icon.Zap className='sf-ext-summary__upgrade-icon' />
                {__('Unlock all extensions with Pro', 'subtleforms')}
              </a>
            </>
          )}
        </div>

        {/* Extensions Grid */}
        <div className='sf-ext-grid'>
          {extensions.length > 0 ? (
            extensions.map((ext) => <ExtensionCard key={ext.slug} ext={ext} />)
          ) : (
            <div className='sf-ext-empty'>
              <Icon.Package style={{ width: 28, height: 28, color: 'var(--sf-gray-300, #d1d5db)', marginBottom: 8 }} />
              <p>{__('No extensions found. Please check your installation.', 'subtleforms')}</p>
            </div>
          )}
        </div>

      </div>
    </AdminShell>
  );
}

