import { useEffect, useState } from '@wordpress/element';
import { Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import Icon from '../../../ui/Icon';
import { getSlotItems } from '../../../../shared/extend';
import { crmApi, pageData } from './api';
import '../emailMarketing/emailMarketing.scss';

const EVENT = 'subtleforms:crm-banner';

/**
 * Whether an add-on adds options to the CRMs: the server lists the services it
 * adds extras to, or it registered something in one of the two slots. The
 * check never names an add-on.
 *
 * @return {boolean} True when an add-on adds extras.
 */
export function addonAddsCrmExtras() {
  return (
    pageData().extras.length > 0 ||
    getSlotItems('crm.service.settings').length > 0 ||
    getSlotItems('crm.service.form').length > 0
  );
}

/**
 * Whether the note should be drawn: the server says this user has not
 * dismissed it and no add-on adds extras.
 *
 * @return {boolean} True when the note shows.
 */
export function crmBannerVisible() {
  return pageData().banner.show === true && !addonAddsCrmExtras();
}

/**
 * The one note about SubtleForms Pro in CRM, the same component and dismissal
 * as the one in Email marketing. It is drawn under the service grid and at the
 * bottom of each service's screen; dismissing it in either place hides it in
 * both, and it stays hidden for the user. Information only.
 */
export default function CrmProBanner() {
  const [, tick] = useState(0);

  useEffect(() => {
    const onChange = () => tick((n) => n + 1);
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);

  if (!crmBannerVisible()) {
    return null;
  }
  const { url } = pageData().banner;
  if (!url) {
    return null;
  }

  const dismiss = () => {
    const data = window.subtleformsAdmin?.crm;
    if (data?.banner) data.banner.show = false;
    window.dispatchEvent(new CustomEvent(EVENT));
    crmApi.dismissBanner().catch(() => {
      // Hidden for this page view either way; it comes back on the next
      // load only when the server did not store the choice.
    });
  };

  return (
    <aside className='sf-em-pro' aria-labelledby='sf-crm-pro-title'>
      <div className='sf-em-pro__text'>
        <h3 id='sf-crm-pro-title' className='sf-em-pro__title'>
          {__('Do more with SubtleForms Pro', 'subtleforms')}
        </h3>
        <p className='sf-em-pro__body'>
          {__('Pro adds deals, companies, lifecycle stage and owner, notes on the contact, sending only when conditions match, and a delivery log with retries to HubSpot, plus Salesforce, Pipedrive and Close.', 'subtleforms')}
        </p>
        <a className='sf-em-pro__link' href={url} target='_blank' rel='noopener noreferrer'>
          {__('Learn about SubtleForms Pro', 'subtleforms')}
          <span className='sf-sr-only'> {__('(opens in a new tab)', 'subtleforms')}</span>
        </a>
      </div>
      <Button
        className='sf-em-pro__dismiss'
        icon={<Icon.Close size={16} aria-hidden='true' />}
        label={__('Dismiss', 'subtleforms')}
        size='small'
        onClick={dismiss}
      />
    </aside>
  );
}
