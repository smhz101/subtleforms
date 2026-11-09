/**
 * The connection card of a service: its three states, the masked key and the
 * test button, for each of the three services. The API is mocked.
 */
import { createRoot, useState } from '@wordpress/element';
import { act } from 'react';
import ServiceConnection from './ServiceConnection';
import { emailMarketingApi } from './api';
import { withClient } from '../../../../../tests/js/queryWrapper';

jest.mock('./emailMarketing.scss', () => ({}));
jest.mock('./api', () => ({
  ...jest.requireActual('./api'),
  emailMarketingApi: {
    connect: jest.fn(),
    test: jest.fn(),
    disconnect: jest.fn(),
  },
}));

global.IS_REACT_ACT_ENVIRONMENT = true;

const NONE = { enabled: true, status: 'none', has_key: false, last4: '', account_name: '', account_email: '', error: '' };
const CONNECTED = { enabled: true, status: 'connected', has_key: true, last4: 'us21', account_name: 'Acme Studio', account_email: 'owner@example.com', error: '' };
const BROKEN = { enabled: true, status: 'error', has_key: true, last4: 'us21', account_name: '', account_email: '', error: 'Mailchimp did not accept this API key.' };

let container;
let root;

const states = [];

async function mount(state, service = 'mailchimp', label = 'Mailchimp') {
  states.length = 0;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  const Host = () => {
    const [current, setCurrent] = useState(state);
    return <ServiceConnection service={service} label={label} state={current} onState={(next) => { states.push(next); setCurrent(next); }} />;
  };
  await act(async () => root.render(withClient(<Host />)));
}

const button = (label) => [...container.querySelectorAll('button')].find((b) => b.textContent.trim() === label);

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  jest.clearAllMocks();
  delete window.subtleformsAdmin;
});

test('not set up: a key field, a disabled save button and the Not set up badge', async () => {
  await mount(NONE);
  expect(container.textContent).toContain('Not set up');
  expect(container.querySelector('input[type="password"]')).not.toBeNull();
  expect(button('Save and connect').disabled).toBe(true);
  expect(button('Test connection')).toBeUndefined();
});

test('saving a key connects and shows the account, and the typed key leaves the screen', async () => {
  await mount(NONE);
  emailMarketingApi.connect.mockResolvedValue(CONNECTED);
  const input = container.querySelector('input[type="password"]');
  const typed = 'not-a-real-key-us21';
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, typed);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await act(async () => button('Save and connect').click());

  expect(emailMarketingApi.connect).toHaveBeenCalledWith('mailchimp', typed);
  expect(container.textContent).toContain('Connected');
  expect(container.textContent).toContain('Acme Studio (owner@example.com)');
  expect(container.querySelector('input')).toBeNull();
  expect(container.innerHTML).not.toContain(typed);
});

test('connected: the key is masked to its last characters, with Change key and Test connection', async () => {
  await mount(CONNECTED);
  expect(container.textContent).toContain('Connected');
  expect(container.textContent).toContain('us21');
  expect(container.textContent).toContain('••••');
  expect(container.querySelector('input')).toBeNull();
  expect(button('Change key')).toBeDefined();
  expect(button('Test connection')).toBeDefined();
});

test('Test connection shows the account on success', async () => {
  await mount(CONNECTED);
  emailMarketingApi.test.mockResolvedValue({ ok: true, message: 'Connected to Acme Studio (owner@example.com).', state: CONNECTED });
  await act(async () => button('Test connection').click());
  expect(container.querySelector('[role="status"]').textContent).toContain('Connected to Acme Studio (owner@example.com).');
});

test('Test connection shows a plain error and the Needs attention badge on failure', async () => {
  await mount(CONNECTED);
  emailMarketingApi.test.mockResolvedValue({ ok: false, message: 'Mailchimp did not accept this API key.', state: BROKEN });
  await act(async () => button('Test connection').click());
  expect(container.textContent).toContain('Mailchimp did not accept this API key.');
  expect(container.textContent).toContain('Needs attention');
});

test('needs attention: the saved error is shown', async () => {
  await mount(BROKEN);
  expect(container.textContent).toContain('Needs attention');
  expect(container.textContent).toContain('Mailchimp did not accept this API key.');
});

test('Change key opens the field and Cancel closes it', async () => {
  await mount(CONNECTED);
  await act(async () => button('Change key').click());
  expect(container.querySelector('input[type="password"]')).not.toBeNull();
  await act(async () => button('Cancel').click());
  expect(container.querySelector('input')).toBeNull();
});

test('a refused key shows the reason and keeps the card open', async () => {
  await mount(NONE);
  emailMarketingApi.connect.mockRejectedValue(new Error('Mailchimp did not accept this API key.'));
  const input = container.querySelector('input[type="password"]');
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, 'abc-us1');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await act(async () => button('Save and connect').click());
  expect(container.textContent).toContain('Mailchimp did not accept this API key.');
  expect(container.textContent).toContain('Not set up');
});

test('Disconnect returns the card to Not set up', async () => {
  await mount(CONNECTED);
  emailMarketingApi.disconnect.mockResolvedValue(NONE);
  await act(async () => button('Disconnect').click());
  expect(container.textContent).toContain('Not set up');
});

test('the page data and the sidebar dot follow a successful test', async () => {
  window.subtleformsAdmin = {
    extensions: { email_marketing: { enabled: true, configured: false, builtin: true } },
    emailMarketing: { services: { mailchimp: { enabled: true, configured: false, builtin: true } }, extras: [], banner: { show: false } },
  };
  await mount(BROKEN);
  emailMarketingApi.test.mockResolvedValue({ ok: true, message: 'Connected.', state: CONNECTED });
  await act(async () => button('Test connection').click());
  expect(window.subtleformsAdmin.emailMarketing.services.mailchimp.configured).toBe(true);
  expect(window.subtleformsAdmin.extensions.email_marketing).toMatchObject({ enabled: true, configured: true });
});

test.each([
  ['brevo', 'Brevo', 'xkeysib-', 'https://app.brevo.com/settings/keys/api'],
  ['kit', 'Kit', 'V4 Keys', 'https://app.kit.com/account_settings/developer_settings'],
  ['mailchimp', 'Mailchimp', '-us21', 'https://admin.mailchimp.com/account/api/'],
])('%s: the numbered steps name the service and link to its key page in a new tab', async (service, label, hint, href) => {
  await mount(NONE, service, label);
  expect(container.querySelector('ol.sf-steps__list')).not.toBeNull();
  expect(container.textContent).toContain(hint);
  const link = [...container.querySelectorAll('a')].find((a) => a.getAttribute('href') === href);
  expect(link).toBeDefined();
  expect(link.getAttribute('target')).toBe('_blank');
  expect(link.getAttribute('rel')).toContain('noopener');
  expect(container.querySelector('input[type="password"]').getAttribute('placeholder')).toContain(label);
});

test('a connected card keeps the steps in a closed accordion', async () => {
  await mount(CONNECTED);
  const toggle = container.querySelector('button.sf-steps__toggle');
  expect(toggle).not.toBeNull();
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
  expect(container.querySelector('.sf-steps__panel').hasAttribute('hidden')).toBe(true);
  expect(container.querySelector('ol.sf-steps__list')).not.toBeNull();
});

test('a card with no key shows the steps open', async () => {
  await mount(NONE);
  expect(container.querySelector('button.sf-steps__toggle').getAttribute('aria-expanded')).toBe('true');
});

test('the typed key is sent to the right service route', async () => {
  await mount(NONE, 'kit', 'Kit');
  emailMarketingApi.connect.mockResolvedValue({ ...CONNECTED, account_name: 'Kit Greetings' });
  const input = container.querySelector('input[type="password"]');
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, 'k'.repeat(20));
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await act(async () => button('Save and connect').click());
  expect(emailMarketingApi.connect).toHaveBeenCalledWith('kit', 'k'.repeat(20));
});
