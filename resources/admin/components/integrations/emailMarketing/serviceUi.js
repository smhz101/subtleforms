import { __ } from '@wordpress/i18n';

/**
 * What differs between the services on the screens: names of things, help
 * text and which controls exist. The behaviour is the same for all three.
 *
 * - `upper`: a mapped field name is written in capitals (Mailchimp merge
 *   tags, Brevo attributes); Kit custom field keys are kept as typed.
 * - `listRequired`: a form cannot send without a list.
 * - `doi`: `toggle` (a switch), `brevo` (a switch that needs the template set
 *   in Settings) or `none` (the service has no such option; a note is shown).
 */
export const SERVICE_UI = {
  mailchimp: {
    upper: true,
    listRequired: true,
    hasTags: true,
    doi: 'toggle',
    listLabel: __('Audience', 'subtleforms'),
    listChoose: __('Choose an audience', 'subtleforms'),
    listLoading: __('Loading audiences…', 'subtleforms'),
    listError: __('Could not load your audiences.', 'subtleforms'),
    fieldsError: __('Could not load the audience fields.', 'subtleforms'),
    fieldHeader: __('Mailchimp field', 'subtleforms'),
    noFields: __('This audience has no other fields. Add merge fields in Mailchimp under Audience, Settings, Audience fields, then refresh.', 'subtleforms'),
    lastNameNote: '',
    keyPlaceholder: __('Paste your Mailchimp API key', 'subtleforms'),
    keyHelp: __('In Mailchimp, open your profile, then Extras, then API keys, and create a key. It ends with a dash and the data center, for example -us21.', 'subtleforms'),
    keyLink: 'https://mailchimp.com/help/about-api-keys/',
    keyLinkText: __('How to find your Mailchimp API key', 'subtleforms'),
    tagsHelp: __('Comma separated. Every person added gets these tags; new tags are created in Mailchimp.', 'subtleforms'),
    doiHelp: __('New contacts are added as pending and Mailchimp emails them to confirm. People already in the audience are not asked again.', 'subtleforms'),
    updateHelp: __('People already in the audience keep their status (someone who unsubscribed stays unsubscribed) and get their name and other fields updated. Off: people already in the audience are left alone.', 'subtleforms'),
    switchLabel: __('Add people who submit this form to Mailchimp', 'subtleforms'),
  },
  brevo: {
    upper: true,
    listRequired: false,
    hasTags: false,
    doi: 'brevo',
    listLabel: __('List', 'subtleforms'),
    listChoose: __('No list (only create the contact)', 'subtleforms'),
    listLoading: __('Loading lists…', 'subtleforms'),
    listError: __('Could not load your lists.', 'subtleforms'),
    fieldsError: __('Could not load the contact attributes.', 'subtleforms'),
    fieldHeader: __('Brevo attribute', 'subtleforms'),
    noFields: __('Your account has no other contact attributes. Create them in Brevo under Contacts, Settings, Contact attributes, then refresh.', 'subtleforms'),
    lastNameNote: '',
    keyPlaceholder: __('Paste your Brevo API key', 'subtleforms'),
    keyHelp: __('In Brevo, open SMTP & API, then API keys, and create a v3 API key. It starts with xkeysib-. The SMTP password does not work here.', 'subtleforms'),
    keyLink: 'https://help.brevo.com/hc/en-us/articles/209467485',
    keyLinkText: __('How to create a Brevo API key', 'subtleforms'),
    tagsHelp: '',
    doiHelp: __('New contacts get Brevo\'s confirmation email and join the list when they confirm. People Brevo already knows are updated, not asked again. Needs a list and the template set under Settings, Integrations, Email marketing, Brevo.', 'subtleforms'),
    updateHelp: __('People Brevo already has on this list get their name and attributes updated. Off: people already on the list are left alone.', 'subtleforms'),
    switchLabel: __('Add people who submit this form to Brevo', 'subtleforms'),
  },
  kit: {
    upper: false,
    listRequired: false,
    hasTags: true,
    doi: 'none',
    listLabel: __('Kit form', 'subtleforms'),
    listChoose: __('No form (only create the subscriber)', 'subtleforms'),
    listLoading: __('Loading forms…', 'subtleforms'),
    listError: __('Could not load your Kit forms.', 'subtleforms'),
    fieldsError: __('Could not load the custom fields.', 'subtleforms'),
    fieldHeader: __('Kit custom field', 'subtleforms'),
    noFields: __('Your account has no custom fields. Create them in Kit under Subscribers, then refresh.', 'subtleforms'),
    lastNameNote: __('Kit has no last name. It is saved in the custom field last_name, only when you choose a form field here and the field exists in Kit.', 'subtleforms'),
    keyPlaceholder: __('Paste your Kit API key', 'subtleforms'),
    keyHelp: __('In Kit, open Settings, then Developer, and create a v4 API key.', 'subtleforms'),
    keyLink: 'https://developers.kit.com/api-reference/authentication',
    keyLinkText: __('How to create a Kit API key', 'subtleforms'),
    tagsHelp: __('Comma separated. Every person added gets these tags; tags that do not exist yet are created in Kit.', 'subtleforms'),
    doiHelp: __('Kit\'s API has no double opt-in switch, so people are added as active subscribers and this plugin cannot ask them to confirm.', 'subtleforms'),
    updateHelp: __('People already in Kit keep their status and get their first name and custom fields updated. Off: people already in Kit are left alone.', 'subtleforms'),
    switchLabel: __('Add people who submit this form to Kit', 'subtleforms'),
  },
};

/**
 * Descriptor of a service, with plain defaults for a service an add-on adds.
 *
 * @param {string} slug Service slug.
 * @return {Object} Descriptor.
 */
export function uiFor(slug) {
  return (
    SERVICE_UI[slug] || {
      upper: false,
      listRequired: false,
      hasTags: false,
      doi: 'none',
      listLabel: __('List', 'subtleforms'),
      listChoose: __('Choose a list', 'subtleforms'),
      listLoading: __('Loading lists…', 'subtleforms'),
      listError: __('Could not load the lists.', 'subtleforms'),
      fieldsError: __('Could not load the fields.', 'subtleforms'),
      fieldHeader: __('Field', 'subtleforms'),
      noFields: __('No other fields.', 'subtleforms'),
      lastNameNote: '',
      keyPlaceholder: __('Paste your API key', 'subtleforms'),
      keyHelp: '',
      keyLink: '',
      keyLinkText: '',
      tagsHelp: '',
      doiHelp: '',
      updateHelp: '',
      switchLabel: __('Add people who submit this form', 'subtleforms'),
    }
  );
}
