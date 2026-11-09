import { __ } from '@wordpress/i18n';
import { adminLink } from '../adminLinks';

/** HubSpot's own guide to service keys. */
export const HUBSPOT_SERVICE_KEYS_GUIDE = 'https://developers.hubspot.com/docs/apps/developer-platform/build-apps/authentication/account-service-keys';

/** The HubSpot app. It opens the account of the person who is signed in. */
export const HUBSPOT_APP = 'https://app.hubspot.com/';

/**
 * Scopes the key needs for what this plugin does on its own: create or update
 * a contact by email, and list the contact properties a form field can fill.
 * Add-ons that do more list their own (see Pro's HubSpot extras).
 */
export const HUBSPOT_SCOPES = ['crm.objects.contacts.read', 'crm.objects.contacts.write', 'crm.schemas.contacts.read'];

/**
 * The steps to connect HubSpot with a service key.
 *
 * @param {Object} [options]
 * @param {string[]} [options.scopes] Scopes to tick; defaults to the contact scopes.
 * @return {{intro:string,steps:Array,note:string}} Props for ConnectionSteps.
 */
export function hubspotSteps({ scopes = HUBSPOT_SCOPES } = {}) {
  return {
    intro: __('SubtleForms signs in to HubSpot with a service key. You create it once in your HubSpot account and it takes about three minutes.', 'subtleforms'),
    steps: [
      {
        text: __('Open your HubSpot account and sign in. You must be a super admin, or have the "Developer tools access" permission.', 'subtleforms'),
        href: HUBSPOT_APP,
        hrefLabel: __('Open HubSpot', 'subtleforms'),
      },
      {
        text: __('In HubSpot, open "Development" in the main menu, then "Keys" in the left sidebar, then "Service keys".', 'subtleforms'),
        href: HUBSPOT_SERVICE_KEYS_GUIDE,
        hrefLabel: __('Read HubSpot\'s guide to service keys', 'subtleforms'),
      },
      {
        text: __('Press "Create service key" in the top right and give the key a name, for example the name of this site.', 'subtleforms'),
      },
      {
        text: __('Press "Add new scope". In the panel on the right, tick each of these scopes, then press "Update". You can paste a name into "Find a scope" to look it up.', 'subtleforms'),
        code: scopes.join('\n'),
      },
      {
        text: __('Open the key by clicking its name in the list. Under the key, press "Show" and then "Copy".', 'subtleforms'),
      },
      {
        text: __('Paste the key into the "HubSpot service key" field below and press "Save and connect". You should see the name and number of your HubSpot account.', 'subtleforms'),
      },
      {
        text: __('On this site, open the form that should create contacts. Go to Form settings, then Integrations, then HubSpot, and switch it on.', 'subtleforms'),
        href: adminLink('forms'),
        hrefLabel: __('Open your forms', 'subtleforms'),
      },
    ],
    note: __('A legacy private app access token also works in the same field. HubSpot now lists private apps under "Legacy apps" and is switching off the creation of new ones. A service key can be rotated: if HubSpot rotates yours, paste the new key here and press "Save and connect".', 'subtleforms'),
  };
}
