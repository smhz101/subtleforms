import { __ } from '@wordpress/i18n';
import CrmConnection from './CrmConnection';
import { hubspotSteps } from './hubspotSteps';
import '../emailMarketing/emailMarketing.scss';

/** What differs on the HubSpot connection card: names, help text and the steps. */
export const HUBSPOT_UI = {
  fieldLabel: __('HubSpot service key', 'subtleforms'),
  placeholder: 'pat-na1-...',
  tokenHelp: __('Create it under Development > Keys > Service keys in your HubSpot account. A legacy private app access token also works.', 'subtleforms'),
  stepsTitle: __('How to connect HubSpot', 'subtleforms'),
  steps: hubspotSteps,
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
