import { __ } from '@wordpress/i18n';
import { adminLink, settingsLink } from '../../integrations/adminLinks';

/** What a webhook sends by default, shortened to two answers. */
export const SAMPLE_PAYLOAD = `{
  "event": "submission.created",
  "form_id": 12,
  "form_title": "Contact",
  "submission_id": 345,
  "created_at": "2026-01-15T09:30:00+00:00",
  "site_url": "https://example.com/",
  "entry_url": "https://example.com/wp-admin/admin.php?page=subtleforms-submissions&submission_id=345",
  "fields": { "name": "Ada Lovelace", "email": "ada@example.com" },
  "answers": [
    { "key": "name", "label": "Name", "value": "Ada Lovelace" },
    { "key": "email", "label": "Email", "value": "ada@example.com" }
  ]
}`;

/**
 * Steps to send a form's entries to a webhook. A webhook has no account to
 * connect: it is an address that receives the entry, so every step happens on
 * this site except getting the address from the service that receives it.
 *
 * @return {{intro:string,steps:Array,note:string}} Props for ConnectionSteps.
 */
export function webhookSteps() {
  return {
    intro: __('A webhook sends each entry to an address you choose, as soon as the entry is saved. The service that receives it gives you the address.', 'subtleforms'),
    steps: [
      {
        text: __('In the service that should receive the entries (for example Zapier, Make or n8n), create a trigger that waits for a webhook, and copy the address it gives you.', 'subtleforms'),
      },
      {
        text: __('On this site, open the form. Go to Form settings, then Notifications, and press "Send to webhook".', 'subtleforms'),
        href: adminLink('forms'),
        hrefLabel: __('Open your forms', 'subtleforms'),
      },
      {
        text: __('Paste the address into the "Webhook URL" field and save the form.', 'subtleforms'),
      },
      {
        text: __('To check the address first, paste it into "Test an endpoint" on this screen and press "Send test request". You should see the answer the receiving service gave.', 'subtleforms'),
        href: settingsLink('webhooks'),
        hrefLabel: __('Open the webhook settings', 'subtleforms'),
      },
      {
        text: __('This is the JSON body the receiving service gets for each entry. You can change it on the webhook action.', 'subtleforms'),
        code: SAMPLE_PAYLOAD,
      },
    ],
    note: __('Each attempt, including retries, is written to the entry\'s activity log.', 'subtleforms'),
  };
}
