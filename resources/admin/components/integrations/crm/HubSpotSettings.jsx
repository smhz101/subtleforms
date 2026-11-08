import { __ } from '@wordpress/i18n';
import CrmConnection from './CrmConnection';
import '../emailMarketing/emailMarketing.scss';

/** What differs on the HubSpot connection card: names and help text. */
export const HUBSPOT_UI = {
  placeholder: __('Paste your HubSpot access token', 'subtleforms'),
  tokenHelp: __(
    'In HubSpot, open Settings, Integrations, Private Apps, create an app with the scopes crm.objects.contacts.read and crm.objects.contacts.write, and copy its access token. It starts with pat-.',
    'subtleforms'
  ),
  tokenLink: 'https://developers.hubspot.com/docs/api/private-apps',
  tokenLinkText: __('How to create a HubSpot private app', 'subtleforms'),
};

/**
 * The settings screen of HubSpot: the connection and nothing else. Which form
 * sends contacts, and which answer goes to which property, is set per form
 * under Form settings > Integrations > CRM.
 *
 * @param {Object}   props
 * @param {string}   props.service      Service slug.
 * @param {Object}   props.connection   Connection state.
 * @param {Function} props.onConnection Called with the new state after a change.
 */
export default function HubSpotSettings({ service, connection, onConnection }) {
  return (
    <div className='sf-em-settings'>
      <CrmConnection service={service} label='HubSpot' state={connection} onState={onConnection} ui={HUBSPOT_UI} />
    </div>
  );
}
