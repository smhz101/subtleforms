/**
 * The Mailchimp connection card: its three states, the masked key and the
 * test button. The API is mocked.
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';
import ConnectionCard from './ConnectionCard';
import { mailchimpApi } from './api';

jest.mock('./mailchimp.scss', () => ({}));
jest.mock('./api', () => ({
  ...jest.requireActual('./api'),
  mailchimpApi: {
    state: jest.fn(),
    connect: jest.fn(),
    test: jest.fn(),
    disconnect: jest.fn(),
  },
}));

global.IS_REACT_ACT_ENVIRONMENT = true;

const NONE = { status: 'none', has_key: false, last4: '', account_name: '', account_email: '', error: '' };
const CONNECTED = { status: 'connected', has_key: true, last4: 'us21', account_name: 'Acme Studio', account_email: 'owner@example.com', error: '' };
const BROKEN = { status: 'error', has_key: true, last4: 'us21', account_name: '', account_email: '', error: 'Mailchimp did not accept this API key.' };

let container;
let root;

async function mount(state) {
  mailchimpApi.state.mockResolvedValue(state);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(<ConnectionCard />));
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
  mailchimpApi.connect.mockResolvedValue(CONNECTED);
  const input = container.querySelector('input[type="password"]');
  const typed = 'not-a-real-key-us21';
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, typed);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await act(async () => button('Save and connect').click());

  expect(mailchimpApi.connect).toHaveBeenCalledWith(typed);
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
  mailchimpApi.test.mockResolvedValue({ ok: true, message: 'Connected to Acme Studio (owner@example.com).', state: CONNECTED });
  await act(async () => button('Test connection').click());
  expect(container.querySelector('[role="status"]').textContent).toContain('Connected to Acme Studio (owner@example.com).');
});

test('Test connection shows a plain error and the Needs attention badge on failure', async () => {
  await mount(CONNECTED);
  mailchimpApi.test.mockResolvedValue({ ok: false, message: 'Mailchimp did not accept this API key.', state: BROKEN });
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
  mailchimpApi.connect.mockRejectedValue(new Error('Mailchimp did not accept this API key.'));
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
  mailchimpApi.disconnect.mockResolvedValue(NONE);
  await act(async () => button('Disconnect').click());
  expect(container.textContent).toContain('Not set up');
});

test('the sidebar is told when the status changes', async () => {
  window.subtleformsAdmin = { extensions: { mailchimp: { enabled: false, configured: false, builtin: true } } };
  await mount(CONNECTED);
  expect(window.subtleformsAdmin.extensions.mailchimp).toMatchObject({ enabled: true, configured: true });
});
