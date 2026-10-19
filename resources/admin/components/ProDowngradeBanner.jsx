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

export default function ProDowngradeBanner({ featuresUsed = [] }) {
  if (!featuresUsed.length) return null;
  return (
    <div className='sf-pro-downgrade-banner'>
      <Notice status='info' isDismissible={false} className='sf-pro-downgrade-banner__notice'>
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
      </Notice>
    </div>
  );
}
