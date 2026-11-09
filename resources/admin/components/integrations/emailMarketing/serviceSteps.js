import { __, sprintf } from '@wordpress/i18n';
import { adminLink } from '../adminLinks';

/**
 * The connection steps of each email marketing service, for ConnectionSteps.
 * Every step that happens on the service's own website carries the address of
 * that page; every step on this site carries the real admin address.
 *
 * Written to one pattern: say where the person is, name the button in
 * quotes, say what to copy and where to paste it, and end with how to see
 * that it worked.
 */

/** The step that finishes every service: turn it on for a form. */
function formStep(label, choice) {
  return {
    text: sprintf(
      /* translators: 1: service name, 2: what the person chooses, for example "the audience" */
      __('On this site, open the form that should send people to %1$s. Go to Form settings, then Integrations, then %1$s, switch it on and choose %2$s.', 'subtleforms'),
      label,
      choice
    ),
    href: adminLink('forms'),
    hrefLabel: __('Open your forms', 'subtleforms'),
  };
}

/** The step after pasting a key. */
function connectStep(label, field) {
  return {
    text: sprintf(
      /* translators: 1: field label, 2: service name */
      __('Paste the key into the "%1$s" field below and press "Save and connect". You should see the name of your %2$s account.', 'subtleforms'),
      field,
      label
    ),
  };
}

const TEST_NOTE = __('To check the whole path, send a test entry through the form. The entry\'s activity log should say that the person was added.', 'subtleforms');

/**
 * Steps for a service.
 *
 * @param {string} service Service slug.
 * @param {Object} [local] For MailPoet: the addresses the server gave (`install_url`, `setup_url`, `manage_url`).
 * @return {{intro:string,steps:Array,note:string}|null} Null for a service this plugin has no steps for.
 */
export function stepsFor(service, local = {}) {
  switch (service) {
    case 'mailchimp':
      return {
        intro: __('You need a Mailchimp account and the right to create API keys. This takes about two minutes.', 'subtleforms'),
        steps: [
          {
            text: __('In Mailchimp, open the API keys page. Sign in if Mailchimp asks you to.', 'subtleforms'),
            href: 'https://admin.mailchimp.com/account/api/',
            hrefLabel: __('Open Mailchimp API keys', 'subtleforms'),
          },
          {
            text: __('Under "Your API Keys", press "Create New Key" and name it after this site, for example "Website forms".', 'subtleforms'),
          },
          {
            text: __('Copy the new key straight away, because Mailchimp does not show it again. It ends with a dash and the name of your data center, for example -us21.', 'subtleforms'),
          },
          connectStep('Mailchimp', __('API key', 'subtleforms')),
          {
            text: __('Make sure you have an audience, because every person who sends a form is added to one. If you have none, create one first.', 'subtleforms'),
            href: 'https://mailchimp.com/help/create-audience',
            hrefLabel: __('Read how to create an audience', 'subtleforms'),
          },
          formStep('Mailchimp', __('the audience', 'subtleforms')),
        ],
        note: TEST_NOTE,
      };
    case 'brevo':
      return {
        intro: __('You need a Brevo account and the right to create API keys. This takes about three minutes.', 'subtleforms'),
        steps: [
          {
            text: __('In Brevo, open the API keys page. You can also reach it from the account menu: "Settings", then "SMTP & API", then "API Keys & MCP".', 'subtleforms'),
            href: 'https://app.brevo.com/settings/keys/api',
            hrefLabel: __('Open Brevo API keys', 'subtleforms'),
          },
          {
            text: __('Press "Generate API key". Brevo sends a verification code to your device: enter it and press "Verify".', 'subtleforms'),
          },
          {
            text: __('Give the key a name, for example the name of this site. Under "Access" choose "Full". A "Restricted" key works only if it can read and write contacts.', 'subtleforms'),
          },
          {
            text: __('Copy the key, because Brevo shows it only once. It starts with xkeysib-. The SMTP password does not work here. Then press "I\'ve saved my key".', 'subtleforms'),
          },
          connectStep('Brevo', __('API key', 'subtleforms')),
          formStep('Brevo', __('the list, or no list to only create the contact', 'subtleforms')),
        ],
        note: TEST_NOTE,
      };
    case 'kit':
      return {
        intro: __('You need a Kit account. This takes about two minutes.', 'subtleforms'),
        steps: [
          {
            text: __('In Kit, open the Developer settings page. Sign in if Kit asks you to.', 'subtleforms'),
            href: 'https://app.kit.com/account_settings/developer_settings',
            hrefLabel: __('Open Kit developer settings', 'subtleforms'),
          },
          {
            text: __('In the "V4 Keys" section, press "Add a new key". Older V3 keys do not work here.', 'subtleforms'),
          },
          {
            text: __('Give the key a name, for example the name of this site, and copy it. Kit does not show it again once you leave the screen.', 'subtleforms'),
          },
          connectStep('Kit', __('API key', 'subtleforms')),
          formStep('Kit', __('the Kit form, or no form to only create the subscriber', 'subtleforms')),
        ],
        note: TEST_NOTE,
      };
    case 'mailpoet':
      return {
        intro: __('MailPoet is a plugin on this site, so there is no key to copy. You only need it installed, set up and holding a list.', 'subtleforms'),
        steps: [
          {
            text: __('In WordPress, open Plugins, then "Add New Plugin". Search for MailPoet, press "Install Now" and then "Activate".', 'subtleforms'),
            href: local.install_url,
            hrefLabel: __('Open the plugin search', 'subtleforms'),
          },
          {
            text: __('Finish the MailPoet setup wizard. This screen says "MailPoet is active on this site" when it is done.', 'subtleforms'),
            href: local.setup_url,
            hrefLabel: __('Open the MailPoet setup', 'subtleforms'),
          },
          {
            text: __('In MailPoet, open "Lists". Use a list you already have, or press "New list" to create one for the people who send your forms.', 'subtleforms'),
            href: local.manage_url,
            hrefLabel: __('Open the MailPoet lists', 'subtleforms'),
          },
          formStep('MailPoet', __('the list', 'subtleforms')),
        ],
        note: TEST_NOTE,
      };
    default:
      return null;
  }
}
