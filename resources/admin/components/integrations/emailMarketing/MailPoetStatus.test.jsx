/**
 * MailPoet's status section in Settings > Integrations > Email marketing: one
 * text and at most one next step for each state of MailPoet on the site.
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';
import MailPoetStatus, { describeState } from './MailPoetStatus';

jest.mock('./emailMarketing.scss', () => ({}));

global.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;

async function mount(local) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(<MailPoetStatus connection={{ connected: local.state === 'ready', local }} />));
}

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const text = () => container.querySelector('[data-testid="mailpoet-status"]').textContent;
const link = () => container.querySelector('[data-testid="mailpoet-status"] a, [data-testid="mailpoet-status"] .components-button[href]');
const badge = () => container.querySelector('.sf-em-badge').textContent;

const URLS = {
  manage_url: 'http://x.test/wp-admin/admin.php?page=mailpoet-lists',
  setup_url: 'http://x.test/wp-admin/admin.php?page=mailpoet-welcome-wizard',
  activate_url: 'http://x.test/wp-admin/plugins.php?action=activate&plugin=mailpoet%2Fmailpoet.php&_wpnonce=abc',
  install_url: 'http://x.test/wp-admin/plugin-install.php?s=mailpoet&tab=search&type=term',
  update_url: 'http://x.test/wp-admin/plugins.php',
};

describe('MailPoet status', () => {
  test('active and set up: says so, shows the Connected badge and links to the lists, with no key, test or disconnect', async () => {
    await mount({ state: 'ready', ...URLS });
    expect(text()).toContain('MailPoet is active on this site.');
    expect(badge()).toBe('Connected');
    expect(link().textContent).toBe('Manage lists in MailPoet');
    expect(link().getAttribute('href')).toBe(URLS.manage_url);
    expect(container.querySelector('input')).toBeNull();
    expect(container.textContent).not.toMatch(/Test connection|Disconnect|API key/);
  });

  test('installed but not active: explains and offers the activation link', async () => {
    await mount({ state: 'inactive', ...URLS });
    expect(text()).toContain('MailPoet is installed but not active');
    expect(link().textContent).toBe('Activate MailPoet');
    expect(link().getAttribute('href')).toBe(URLS.activate_url);
    expect(text()).toContain('Nothing is sent to MailPoet until it is active and set up.');
  });

  test('installed but not active, for a user who may not activate: asks an administrator, no link', async () => {
    await mount({ state: 'inactive', ...URLS, activate_url: '' });
    expect(link()).toBeNull();
    expect(text()).toContain('Ask an administrator to activate MailPoet.');
  });

  test('active but its setup is not finished: links to the setup', async () => {
    await mount({ state: 'setup', ...URLS });
    expect(text()).toContain('its setup is not finished');
    expect(link().textContent).toBe('Finish MailPoet setup');
    expect(link().getAttribute('href')).toBe(URLS.setup_url);
  });

  test('not installed: describes the plugin and offers the installer search, and says nothing is sent', async () => {
    await mount({ state: 'not_installed', ...URLS });
    expect(text()).toContain('MailPoet is a free plugin for sending newsletters from WordPress.');
    expect(link().textContent).toBe('Install MailPoet');
    expect(link().getAttribute('href')).toBe('http://x.test/wp-admin/plugin-install.php?s=mailpoet&tab=search&type=term');
    expect(text()).toContain('Nothing is sent to MailPoet until it is active and set up.');
  });

  test('not installed, for a user who may not install: asks an administrator', async () => {
    await mount({ state: 'not_installed', ...URLS, install_url: '' });
    expect(link()).toBeNull();
    expect(text()).toContain('Ask an administrator to install MailPoet.');
  });

  test('too old: asks for an update', async () => {
    await mount({ state: 'outdated', ...URLS });
    expect(text()).toContain('Update MailPoet to use it with SubtleForms.');
    expect(badge()).toBe('Needs attention');
  });

  test('describeState gives a badge and a sentence for every state, and the not installed one for an unknown state', () => {
    ['ready', 'inactive', 'setup', 'outdated', 'not_installed', 'something-else'].forEach((s) => {
      const d = describeState(s);
      expect(d.text.length).toBeGreaterThan(10);
      expect(['connected', 'none', 'error']).toContain(d.badge);
    });
    expect(describeState('something-else').text).toBe(describeState('not_installed').text);
  });
});
