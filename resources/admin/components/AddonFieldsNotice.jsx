/**
 * Add-on fields note.
 *
 * Shows in the builder when a form has fields or settings that an add-on
 * provides and no active plugin provides them now. The form stays editable;
 * nothing is removed from it, and the live form uses them again once the
 * add-on is active.
 */

import { Notice } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import './AddonFieldsNotice.scss';

export default function AddonFieldsNotice({ featuresUsed = [], limited = [] }) {
  if (!featuresUsed.length && !limited.length) return null;
  return (
    <div className='sf-addon-fields-notice'>
      <Notice status='info' isDismissible={false} className='sf-addon-fields-notice__notice'>
        {featuresUsed.length > 0 && (
          <p className='sf-addon-fields-notice__message'>
            {sprintf(
              /* translators: %s: list of field names as written in the form, for example "Your signature, Total" */
              __(
                'This form contains fields that need an add-on that is not active: %s. The fields are kept in the form.',
                'subtleforms'
              ),
              featuresUsed.join(', ')
            )}
          </p>
        )}
        {limited.length > 0 && (
          <p className='sf-addon-fields-notice__message'>
            {sprintf(
              /* translators: %s: list of settings, for example "Picture Choice (shown without pictures)" */
              __(
                'These settings are provided by an add-on that is not active: %s. They stay saved in the form.',
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
