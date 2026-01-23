/**
 * Pro Downgrade Banner
 *
 * Shows when a Pro form is opened without active license.
 * Provides clear feedback and call-to-action.
 */

import { Notice, Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import Icon from './ui/Icon';
import './ProDowngradeBanner.scss';

export default function ProDowngradeBanner({ featuresUsed = [] }) {
  const handleActivateLicense = () => {
    // Navigate to Pro License page
    const licenseUrl = window.subtleformsAdmin?.proLicenseUrl || '/wp-admin/admin.php?page=subtleforms-pro';
    window.location.href = licenseUrl;
  };

  return (
    <div className='sf-pro-downgrade-banner'>
      <Notice status='warning' isDismissible={false} className='sf-pro-downgrade-banner__notice'>
        <div className='sf-pro-downgrade-banner__content'>
          <div className='sf-pro-downgrade-banner__icon'>
            <Icon.Lock />
          </div>
          <div className='sf-pro-downgrade-banner__text'>
            <strong className='sf-pro-downgrade-banner__title'>
              {__('This form uses Pro features', 'subtleforms')}
            </strong>
            <p className='sf-pro-downgrade-banner__message'>
              {__('This form is in read-only mode. Activate a Pro license to edit. Your form continues working on the frontend—no data loss, no interruption.', 'subtleforms')}
            </p>
            {featuresUsed.length > 0 && (
              <p className='sf-pro-downgrade-banner__features'>
                <strong>{__('Pro features in use:', 'subtleforms')}</strong> {featuresUsed.join(', ')}
              </p>
            )}
          </div>
          <Button
            variant='primary'
            onClick={handleActivateLicense}
            className='sf-pro-downgrade-banner__button'>
            {__('Activate License', 'subtleforms')}
          </Button>
        </div>
      </Notice>
    </div>
  );
}
