/**
 * Email marketing state as cached queries: a service screen starts from the
 * all-services answer (preloaded with Settings), and every change writes the
 * new state back.
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';

jest.mock('./api', () => ({
  ...jest.requireActual('./api'),
  emailMarketingApi: {
    all: jest.fn(),
    state: jest.fn(),
    setEnabled: jest.fn(),
    connect: jest.fn(),
    test: jest.fn(),
    disconnect: jest.fn(),
    lists: jest.fn(),
    fields: jest.fn(),
    brevoTemplates: jest.fn(),
    saveSettings: jest.fn(),
  },
}));

import { emailMarketingApi } from './api';
import { queryKeys } from '../../../data/queryKeys';
import {
  useServiceState,
  useSetServiceEnabled,
  useConnectService,
  useDisconnectService,
  fetchLists,
} from './queries';
import { testClient, withClient } from '../../../../../tests/js/queryWrapper';

global.IS_REACT_ACT_ENVIRONMENT = true;

const NONE = { enabled: false, status: 'none', has_key: false, connected: false };
const CONNECTED = { enabled: true, status: 'connected', has_key: true, connected: true, account_name: 'Acme' };

let container;
let root;
let hooks;

function Probe({ service }) {
  const state = useServiceState(service);
  hooks = {
    state,
    setEnabled: useSetServiceEnabled(),
    connect: useConnectService(service),
    disconnect: useDisconnectService(service),
  };
  return <p className='out'>{state.data ? state.data.status : 'loading'}</p>;
}

async function mount(client, service = 'kit') {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(withClient(<Probe service={service} />, client)));
}

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  jest.clearAllMocks();
});

test('a service screen renders from the all-services answer in the cache, with no request', async () => {
  const client = testClient({ queries: { staleTime: 60 * 1000 } });
  client.setQueryData(queryKeys.emailMarketing.all(), { services: { kit: NONE } });
  await mount(client);
  expect(container.querySelector('.out').textContent).toBe('none');
  expect(emailMarketingApi.state).not.toHaveBeenCalled();
});

test('with nothing cached the state is fetched once and kept for the next screen', async () => {
  emailMarketingApi.state.mockResolvedValue(CONNECTED);
  const client = testClient({ queries: { staleTime: 60 * 1000 } });
  await mount(client);
  expect(emailMarketingApi.state).toHaveBeenCalledWith('kit');
  expect(container.querySelector('.out').textContent).toBe('connected');
  await act(async () => root.unmount());
  container.remove();
  await mount(client);
  expect(emailMarketingApi.state).toHaveBeenCalledTimes(1);
});

test('switching a service writes its new state to the cache and marks the list stale', async () => {
  const client = testClient({ queries: { staleTime: 60 * 1000 } });
  client.setQueryData(queryKeys.emailMarketing.all(), { services: { kit: NONE } });
  emailMarketingApi.setEnabled.mockResolvedValue({ ...NONE, enabled: true });
  await mount(client);
  await act(async () => {
    await hooks.setEnabled.mutateAsync({ service: 'kit', enabled: true });
  });
  expect(emailMarketingApi.setEnabled).toHaveBeenCalledWith('kit', true);
  expect(client.getQueryData(queryKeys.emailMarketing.state('kit')).enabled).toBe(true);
  expect(client.getQueryState(queryKeys.emailMarketing.all()).isInvalidated).toBe(true);
});

test('connecting and disconnecting update the state and forget the other account\'s lists', async () => {
  const client = testClient({ queries: { staleTime: 60 * 1000 } });
  client.setQueryData(queryKeys.emailMarketing.all(), { services: { kit: NONE } });
  client.setQueryData(queryKeys.emailMarketing.lists('kit'), [{ id: '1', name: 'Old' }]);
  emailMarketingApi.connect.mockResolvedValue(CONNECTED);
  emailMarketingApi.disconnect.mockResolvedValue(NONE);
  await mount(client);

  await act(async () => {
    await hooks.connect.mutateAsync('key-value');
  });
  expect(emailMarketingApi.connect).toHaveBeenCalledWith('kit', 'key-value');
  expect(container.querySelector('.out').textContent).toBe('connected');
  expect(client.getQueryData(queryKeys.emailMarketing.lists('kit'))).toBeUndefined();

  await act(async () => {
    await hooks.disconnect.mutateAsync();
  });
  expect(container.querySelector('.out').textContent).toBe('none');
});

test('lists are cached for five minutes and a refresh asks again', async () => {
  emailMarketingApi.lists.mockResolvedValue([{ id: '1', name: 'Main' }]);
  const client = testClient();
  await fetchLists(client, 'kit');
  await fetchLists(client, 'kit');
  expect(emailMarketingApi.lists).toHaveBeenCalledTimes(1);
  await fetchLists(client, 'kit', true);
  expect(emailMarketingApi.lists).toHaveBeenCalledTimes(2);
  expect(emailMarketingApi.lists).toHaveBeenLastCalledWith('kit', true);
});
