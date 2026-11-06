/**
 * The shared data layer add-ons use: a cached REST read, and the pieces on
 * window.SubtleFormsExtend.
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';
import apiFetch from '@wordpress/api-fetch';
import * as reactQuery from '@tanstack/react-query';

jest.mock('@wordpress/api-fetch', () => jest.fn());

import { restPath, useRestQuery } from './restQuery';
import { exposeDataLayer } from './expose';
import { queryClient } from './queryClient';
import { testClient, withClient } from '../../../tests/js/queryWrapper';

global.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;

beforeEach(() => {
  apiFetch.mockReset();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe('restPath', () => {
  it('takes a path as relative to /subtleforms/v1 unless it names a namespace', () => {
    expect(restPath('/pro/orders')).toBe('/subtleforms/v1/pro/orders');
    expect(restPath('pro/orders?page=2')).toBe('/subtleforms/v1/pro/orders?page=2');
    expect(restPath('/subtleforms/v1/settings')).toBe('/subtleforms/v1/settings');
    expect(restPath('/wp/v2/users')).toBe('/wp/v2/users');
  });
});

describe('useRestQuery', () => {
  // A Pro screen that caches its settings for 60 seconds and invalidates on save.
  function Screen({ label }) {
    const settings = useRestQuery({ key: [ 'pro', 'settings' ], path: '/pro/settings', staleTime: 60 * 1000 });
    const client = reactQuery.useQueryClient();
    const save = reactQuery.useMutation( {
      mutationFn: () => apiFetch( { path: '/subtleforms/v1/pro/settings', method: 'POST', data: {} } ),
      onSuccess: () => client.invalidateQueries( { queryKey: [ 'pro', 'settings' ] } ),
    } );
    return (
      <div>
        <p className='out'>{ label }:{ settings.data ? settings.data.name : 'loading' }</p>
        <button type='button' onClick={ () => save.mutate() }>save</button>
      </div>
    );
  }

  it('calls apiFetch with the full path and renders the answer', async () => {
    apiFetch.mockResolvedValue({ name: 'one' });
    await act(async () => root.render(withClient(<Screen label='a' />)));
    expect(apiFetch).toHaveBeenCalledTimes(1);
    expect(apiFetch.mock.calls[0][0]).toMatchObject({ path: '/subtleforms/v1/pro/settings', method: 'GET' });
    expect(container.querySelector('.out').textContent).toBe('a:one');
  });

  it('renders from the cache on a second mount without a new request', async () => {
    apiFetch.mockResolvedValue({ name: 'one' });
    const client = testClient();
    await act(async () => root.render(withClient(<Screen label='a' />, client)));
    expect(apiFetch).toHaveBeenCalledTimes(1);

    await act(async () => root.unmount());
    root = createRoot(container);
    await act(async () => root.render(withClient(<Screen label='b' />, client)));
    // Painted from the cache, and still one request in total.
    expect(container.querySelector('.out').textContent).toBe('b:one');
    expect(apiFetch).toHaveBeenCalledTimes(1);
  });

  it('asks the server again after a save invalidates the key', async () => {
    apiFetch.mockImplementation(({ method }) => Promise.resolve(method === 'POST' ? { ok: true } : { name: apiFetch.mock.calls.length > 2 ? 'two' : 'one' }));
    const client = testClient();
    await act(async () => root.render(withClient(<Screen label='a' />, client)));
    expect(container.querySelector('.out').textContent).toBe('a:one');

    await act(async () => {
      container.querySelector('button').click();
    });
    const gets = apiFetch.mock.calls.filter(([o]) => o.method === 'GET');
    expect(gets).toHaveLength(2);
    expect(container.querySelector('.out').textContent).toBe('a:two');
  });
});

describe('the public data layer', () => {
  it('puts the live client and the hooks on the extension object', () => {
    const target = {};
    exposeDataLayer(target);
    expect(target.queryClient).toBe(queryClient);
    expect(target.useQuery).toBe(reactQuery.useQuery);
    expect(target.useMutation).toBe(reactQuery.useMutation);
    expect(target.useQueryClient).toBe(reactQuery.useQueryClient);
    expect(target.QueryClientProvider).toBe(reactQuery.QueryClientProvider);
    expect(target.useRestQuery).toBe(useRestQuery);
    expect(target.restPath).toBe(restPath);
  });

  it('is on window.SubtleFormsExtend once the admin script has run', () => {
    expect(window.SubtleFormsExtend.queryClient).toBe(queryClient);
    expect(typeof window.SubtleFormsExtend.useRestQuery).toBe('function');
  });
});
