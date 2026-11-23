/**
 * An email notification warns when the Settings, Email switch for its
 * audience is off, because it would not be sent (#134).
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';

jest.mock('./ActionsPanel.scss', () => ({}), { virtual: true });
jest.mock('../../data/apiClient', () => ({ apiClient: { get: jest.fn() } }));

import { apiClient } from '../../data/apiClient';
import ActionsPanel from './ActionsPanel';

global.IS_REACT_ACT_ENVIRONMENT = true;

const schemaTo = (to) => ({
  metadata: { title: 'Contact' },
  fields: [ { id: 'email', key: 'email', type: 'email', label: 'Email' } ],
  actions: [ { id: 'mail_1', type: 'email', enabled: true, settings: { to, subject: 'Hi', message: '', format: 'html' } } ],
});

async function mount(schema, settings) {
  // The settings endpoint answers { success, data }.
  apiClient.get.mockResolvedValue({ success: true, data: settings });
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => { root.render(<ActionsPanel schema={schema} onChange={() => {}} />); });
  await act(async () => { await Promise.resolve(); });
  return { container, unmount: () => { act(() => root.unmount()); container.remove(); } };
}

const notice = (container) => container.querySelector('.sf-actions-panel__switch-notice');

test('shows the notice with a link when To is an answer tag and submitter emails are off', async () => {
  const { container, unmount } = await mount(schemaTo('{email}'), { user_confirmation_enabled: false, admin_notification_enabled: true });
  const el = notice(container);
  expect(el).toBeTruthy();
  expect(el.textContent).toContain('Submitter emails are turned off, so this email will not be sent.');
  const link = el.querySelector('a');
  expect(link.textContent).toBe('Turn them on in Settings, Email');
  expect(link.getAttribute('href')).toBe('admin.php?page=subtleforms-settings#tab=email');
  expect(apiClient.get).toHaveBeenCalledTimes(1);
  unmount();
});

test('hides the notice when submitter emails are on', async () => {
  const { container, unmount } = await mount(schemaTo('{email}'), { user_confirmation_enabled: true, admin_notification_enabled: true });
  expect(notice(container)).toBeNull();
  unmount();
});

test('warns about admin notifications for a fixed address when they are off', async () => {
  const { container, unmount } = await mount(schemaTo('owner@example.com'), { user_confirmation_enabled: false, admin_notification_enabled: false });
  expect(notice(container).textContent).toContain('Admin notifications are turned off, so this email will not be sent.');
  unmount();
});

test('a fixed address is not warned about when only submitter emails are off', async () => {
  const { container, unmount } = await mount(schemaTo('owner@example.com'), { user_confirmation_enabled: false, admin_notification_enabled: true });
  expect(notice(container)).toBeNull();
  unmount();
});
