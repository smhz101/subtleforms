import { Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { StatusBadge } from './ServiceConnection';
import { stepsFor } from './serviceSteps';
import ConnectionSteps from '../ConnectionSteps';
import './emailMarketing.scss';

/**
 * What the status section says for each state of MailPoet on this site. The
 * server decides the state (`connection.local.state`) and hands over the
 * addresses, each one only when this user may follow it.
 *
 * @param {string} state not_installed, inactive, outdated, setup or ready.
 * @return {{badge:string,text:string}} Badge status and the sentence.
 */
export function describeState(state) {
  switch (state) {
    case 'ready':
      return { badge: 'connected', text: __('MailPoet is active on this site.', 'subtleforms') };
    case 'inactive':
      return {
        badge: 'none',
        text: __('MailPoet is installed but not active. People can only be added to MailPoet while it is active.', 'subtleforms'),
      };
    case 'setup':
      return {
        badge: 'error',
        text: __('MailPoet is active, but its setup is not finished. People can be added once the setup is done.', 'subtleforms'),
      };
    case 'outdated':
      return { badge: 'error', text: __('Update MailPoet to use it with SubtleForms.', 'subtleforms') };
    default:
      return { badge: 'none', text: __('MailPoet is a free plugin for sending newsletters from WordPress.', 'subtleforms') };
  }
}

/**
 * The status section of MailPoet in Settings > Integrations > Email marketing.
 * MailPoet is a plugin on the same site, so there is no key to paste, nothing
 * to test and nothing to disconnect: the section shows whether MailPoet is
 * ready and the one next step when it is not.
 *
 * @param {Object} props
 * @param {Object} props.connection Connection state from the server (`local` holds MailPoet's state).
 */
export default function MailPoetStatus({ connection }) {
  const local = connection?.local || {};
  const state = local.state || 'not_installed';
  const { badge, text } = describeState(state);

  let action = null;
  if (state === 'ready' && local.manage_url) {
    action = (
      <Button variant='link' href={local.manage_url}>
        {__('Manage lists in MailPoet', 'subtleforms')}
      </Button>
    );
  } else if (state === 'inactive') {
    action = local.activate_url ? (
      <Button variant='primary' href={local.activate_url}>
        {__('Activate MailPoet', 'subtleforms')}
      </Button>
    ) : (
      <p className='sf-em-card__summary'>{__('Ask an administrator to activate MailPoet.', 'subtleforms')}</p>
    );
  } else if (state === 'setup' && local.setup_url) {
    action = (
      <Button variant='primary' href={local.setup_url}>
        {__('Finish MailPoet setup', 'subtleforms')}
      </Button>
    );
  } else if (state === 'not_installed') {
    action = local.install_url ? (
      <Button variant='primary' href={local.install_url}>
        {__('Install MailPoet', 'subtleforms')}
      </Button>
    ) : (
      <p className='sf-em-card__summary'>{__('Ask an administrator to install MailPoet.', 'subtleforms')}</p>
    );
  } else if (state === 'outdated' && local.update_url) {
    action = (
      <Button variant='primary' href={local.update_url}>
        {__('Update MailPoet', 'subtleforms')}
      </Button>
    );
  }

  return (
    <div className='sf-em-settings'>
      <section className='sf-em-card' data-testid='mailpoet-status' data-state={state}>
        <div className='sf-em-card__head'>
          <h4 className='sf-em-card__title'>{__('Status', 'subtleforms')}</h4>
          <StatusBadge status={badge} />
        </div>
        <p className='sf-em-card__summary'>{text}</p>
        {state !== 'ready' && state !== 'outdated' && (
          <p className='sf-em-card__summary'>{__('Nothing is sent to MailPoet until it is active and set up.', 'subtleforms')}</p>
        )}
        {action && <div className='sf-em-card__actions'>{action}</div>}
      </section>
      <ConnectionSteps id='sf-steps-mailpoet' title={__('How to set up MailPoet', 'subtleforms')} {...stepsFor('mailpoet', local)} />
    </div>
  );
}
