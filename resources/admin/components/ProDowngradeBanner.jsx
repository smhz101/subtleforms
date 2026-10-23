/**
 * Missing add-on fields banner.
 *
 * Shows in the builder when a form has fields that SubtleForms Pro provides
 * and Pro is not active. The form stays editable; those fields are kept and
 * come back on the live form when Pro is active again.
 */

import { Notice } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import './ProDowngradeBanner.scss';

export default function ProDowngradeBanner({ featuresUsed = [], limited = [], paymentForm = false }) {
  if (!featuresUsed.length && !limited.length && !paymentForm) return null;
  return (
    <div className='sf-pro-downgrade-banner'>
      <Notice status='info' isDismissible={false} className='sf-pro-downgrade-banner__notice'>
        {paymentForm && (
          <p className='sf-pro-downgrade-banner__message'>
            {__(
              'This form takes payments, which needs SubtleForms Pro. Until Pro is active, visitors see "This form is not available right now." and no entries are accepted.',
              'subtleforms'
            )}
          </p>
        )}
        {featuresUsed.length > 0 && (
          <p className='sf-pro-downgrade-banner__message'>
            {sprintf(
              /* translators: %s: list of field types, for example "Signature, Calculation" */
              __(
                'This form has fields from SubtleForms Pro: %s. They are kept in the form, but the live form leaves them out until SubtleForms Pro is active.',
                'subtleforms'
              ),
              featuresUsed.join(', ')
            )}
          </p>
        )}
        {limited.length > 0 && (
          <p className='sf-pro-downgrade-banner__message'>
            {sprintf(
              /* translators: %s: list of features, for example "Picture Choice (shown without pictures)" */
              __(
                'This form uses features from SubtleForms Pro: %s. Everything stays saved and works again when SubtleForms Pro is active.',
                'subtleforms'
              ),
              limited.join(', ')
            )}
          </p>
        )}
      </Notice>
    </div>
  );
}
