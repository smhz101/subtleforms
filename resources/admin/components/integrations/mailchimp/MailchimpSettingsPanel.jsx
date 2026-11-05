import { useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import ConnectionCard from './ConnectionCard';
import ExtensionSlot from '../../ExtensionSlot';
import './mailchimp.scss';

/**
 * Settings > Integrations > Mailchimp.
 *
 * The connection card is part of this plugin and complete on its own. An
 * add-on may draw more below it in the `integration.mailchimp.settings` slot.
 */
export default function MailchimpSettingsPanel() {
  const [connection, setConnection] = useState(null);

  return (
    <div className='sf-ext-panel'>
      <div className='sf-ext-panel__header'>
        <h2 className='sf-ext-panel__title'>{__('Mailchimp', 'subtleforms')}</h2>
        <p className='sf-ext-panel__description'>
          {__(
            'Add people who fill in a form to a Mailchimp audience. Connect your account here, then switch Mailchimp on for each form under Form settings > Integrations.',
            'subtleforms'
          )}
        </p>
      </div>
      <div className='sf-ext-panel__body'>
        <ConnectionCard onChange={setConnection} />
        <ExtensionSlot name='integration.mailchimp.settings' connection={connection} />
      </div>
    </div>
  );
}
