/**
 * The connection steps of each email marketing service: every service has
 * them, every link is a full https address (or an admin address of this site),
 * and the copy follows the writing rules.
 */
import { stepsFor } from './serviceSteps';
import { isSafeHref } from '../ConnectionSteps';
import { hrefsOf } from '../ConnectionSteps.fixture';

const LOCAL = {
  install_url: 'http://localhost/wp-admin/plugin-install.php?s=mailpoet&tab=search&type=term',
  setup_url: 'http://localhost/wp-admin/admin.php?page=mailpoet-welcome-wizard',
  manage_url: 'http://localhost/wp-admin/admin.php?page=mailpoet-lists',
};

const EXTERNAL = {
  mailchimp: ['https://admin.mailchimp.com/account/api/', 'https://mailchimp.com/help/create-audience'],
  brevo: ['https://app.brevo.com/settings/keys/api'],
  kit: ['https://app.kit.com/account_settings/developer_settings'],
  mailpoet: [],
};

const textOf = (guide) => [guide.intro, guide.note, ...guide.steps.map((step) => step.text)].join('\n');

describe.each(Object.keys(EXTERNAL))('%s steps', (service) => {
  const guide = stepsFor(service, LOCAL);

  test('render as steps with an intro and a note', () => {
    expect(guide.steps.length).toBeGreaterThanOrEqual(4);
    expect(guide.intro).toBeTruthy();
    expect(guide.note).toBeTruthy();
    guide.steps.forEach((step) => expect(typeof step.text).toBe('string'));
  });

  test('every address is https and non-empty, or an address on this site', () => {
    const hrefs = hrefsOf(guide.steps);
    expect(hrefs.length).toBeGreaterThan(0);
    hrefs.forEach((href) => {
      expect(href).not.toBe('');
      expect(isSafeHref(href)).toBe(true);
    });
    EXTERNAL[service].forEach((href) => {
      expect(href.startsWith('https://')).toBe(true);
      expect(hrefs).toContain(href);
    });
  });

  test('follows the writing rules', () => {
    const text = textOf(guide);
    expect(text).not.toMatch(/\u2014|\u2013/);
    expect(text).not.toMatch(/\b(simply|just|easily)\b/i);
    // The last step on this site sends the person to the form, and one step ends with how to see it worked.
    expect(text).toMatch(/Form settings/);
  });
});

test('a service without steps returns null', () => {
  expect(stepsFor('nothing')).toBeNull();
});

test('MailPoet links only to the addresses it was given', () => {
  const guide = stepsFor('mailpoet', { install_url: '', setup_url: LOCAL.setup_url, manage_url: '' });
  expect(hrefsOf(guide.steps)).toContain(LOCAL.setup_url);
  expect(hrefsOf(guide.steps)).not.toContain('');
});
