import ServiceConnection from './ServiceConnection';
import BrevoSettings from './BrevoSettings';
import { getEmailMarketingService } from '../../../../shared/extend';
import './emailMarketing.scss';

/**
 * The settings screen of Mailchimp and Kit: the connection and nothing else.
 *
 * @param {Object}   props
 * @param {string}   props.service      Service slug.
 * @param {Object}   props.connection   Connection state.
 * @param {Function} props.onConnection Called with the new state after a change.
 */
export default function ServiceSettings({ service, connection, onConnection }) {
  const label = getEmailMarketingService(service)?.label || service;
  return (
    <div className='sf-em-settings'>
      <ServiceConnection service={service} label={label} state={connection} onState={onConnection} />
    </div>
  );
}

/**
 * Brevo's settings screen: the connection and the double opt-in settings.
 *
 * @param {Object}   props
 * @param {Object}   props.connection   Connection state.
 * @param {Function} props.onConnection Called with the new state after a change.
 */
export function BrevoScreen({ service, connection, onConnection }) {
  return (
    <div className='sf-em-settings'>
      <ServiceConnection service={service} label='Brevo' state={connection} onState={onConnection} />
      <BrevoSettings connection={connection} onState={onConnection} />
    </div>
  );
}
