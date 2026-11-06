/**
 * Settings opens from the query cache (the page sends the settings with it),
 * does not ask the server again within a minute, and a save invalidates.
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';

jest.mock('../../data/apiClient', () => ({ apiClient: { get: jest.fn() } }));
jest.mock('@wordpress/api-fetch', () => jest.fn());
jest.mock('../../utils/validation', () => ({
  validateSettings: jest.fn(() => ({ isValid: true, errors: {} })),
  validateField: jest.fn(() => ({ isValid: true })),
}));
jest.mock('../../utils/confirmDialog', () => ({ confirmDialog: jest.fn(() => Promise.resolve(true)) }));

import apiFetch from '@wordpress/api-fetch';
import { apiClient } from '../../data/apiClient';
import { queryKeys } from '../../data/queryKeys';
import useSettingsState from '../useSettingsState';
import { testClient, withClient } from '../../../../tests/js/queryWrapper';

global.IS_REACT_ACT_ENVIRONMENT = true;

const SETTINGS = { autosave_interval: 30, submission_limit: 5, debug_mode: false, sender_email: 'a@example.com' };

let container;
let root;
let api;

function Probe() {
  api = useSettingsState();
  return <p className='out'>{api.loading ? 'loading' : api.settings ? `loaded:${api.settings.sender_email}` : 'none'}</p>;
}

async function mount(client) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(withClient(<Probe />, client)));
}

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  jest.clearAllMocks();
});

test('with the settings in the cache the first render has them and no request is made', async () => {
  const client = testClient({ queries: { staleTime: 60 * 1000 } });
  client.setQueryData(queryKeys.settings.general(), { success: true, data: SETTINGS });
  await mount(client);
  expect(container.querySelector('.out').textContent).toBe('loaded:a@example.com');
  expect(apiClient.get).not.toHaveBeenCalled();
});

test('without a cache it asks once, and a second mount within a minute does not', async () => {
  apiClient.get.mockResolvedValue({ success: true, data: SETTINGS });
  const client = testClient({ queries: { staleTime: 60 * 1000 } });
  await mount(client);
  expect(apiClient.get).toHaveBeenCalledTimes(1);
  expect(container.querySelector('.out').textContent).toBe('loaded:a@example.com');
  await act(async () => root.unmount());
  container.remove();
  await mount(client);
  expect(apiClient.get).toHaveBeenCalledTimes(1);
});

test('Discard asks the server even when the cache is fresh', async () => {
  const client = testClient({ queries: { staleTime: 60 * 1000 } });
  client.setQueryData(queryKeys.settings.general(), { success: true, data: SETTINGS });
  apiClient.get.mockResolvedValue({ success: true, data: { ...SETTINGS, sender_email: 'b@example.com' } });
  await mount(client);
  await act(async () => {
    await api.loadSettings();
  });
  expect(apiClient.get).toHaveBeenCalledTimes(1);
  expect(container.querySelector('.out').textContent).toBe('loaded:b@example.com');
});

test('saving stores the saved settings and invalidates every settings query', async () => {
  const client = testClient({ queries: { staleTime: 60 * 1000 } });
  client.setQueryData(queryKeys.settings.general(), { success: true, data: SETTINGS });
  const invalidate = jest.spyOn(client, 'invalidateQueries');
  apiFetch.mockResolvedValue({ success: true, data: { ...SETTINGS, sender_email: 'c@example.com' }, message: 'Saved' });
  await mount(client);
  await act(async () => {
    await api.saveSettings();
  });
  expect(apiFetch.mock.calls[0][0]).toMatchObject({ path: '/subtleforms/v1/settings', method: 'PUT' });
  expect(client.getQueryData(queryKeys.settings.general()).data.sender_email).toBe('c@example.com');
  expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.settings.all });
  expect(client.getQueryState(queryKeys.settings.general()).isInvalidated).toBe(true);
});

test('a background refresh of cached settings does not replace an edit made while it ran', async () => {
  let release;
  apiClient.get.mockImplementation(() => new Promise((resolve) => { release = () => resolve({ success: true, data: { ...SETTINGS, sender_email: 'server@example.com' } }); }));
  const client = testClient({ queries: { staleTime: 0 } });
  // Cached, but older than the minute the screen trusts: it shows at once and refreshes.
  client.setQueryData(queryKeys.settings.general(), { success: true, data: SETTINGS }, { updatedAt: Date.now() - 5 * 60 * 1000 });
  await mount(client);
  expect(container.querySelector('.out').textContent).toBe('loaded:a@example.com');
  expect(apiClient.get).toHaveBeenCalledTimes(1);

  await act(async () => api.updateSetting('sender_email', 'typed@example.com'));
  expect(api.hasChanges).toBe(true);
  await act(async () => release());
  expect(container.querySelector('.out').textContent).toBe('loaded:typed@example.com');
});
