/**
 * Select every entry that matches the view (#143): the bar, the request the
 * bulk action sends, the confirm for destructive actions, and when the
 * "all matching" state ends.
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';

jest.mock('./SubmissionsTable.scss', () => ({}));
jest.mock('./DataTable.scss', () => ({}));
jest.mock('@wordpress/notices', () => {
  const { createReduxStore, register } = require('@wordpress/data');
  const store = createReduxStore('core/notices', {
    reducer: (state = {}) => state,
    actions: {
      createSuccessNotice: () => ({ type: 'NOOP' }),
      createErrorNotice: () => ({ type: 'NOOP' }),
    },
  });
  register(store);
  return { store };
}, { virtual: true });
jest.mock('../utils/api', () => ({
  apiGet: jest.fn(),
  apiPost: jest.fn(),
  apiPut: jest.fn(),
  apiDelete: jest.fn(),
}));
jest.mock('../data', () => ({
  useSettings: () => ({ data: {} }),
  apiClient: { get: jest.fn(), post: jest.fn() },
}));

import { apiGet } from '../utils/api';
import { apiClient } from '../data';
import SubmissionsTable from './SubmissionsTable';

global.IS_REACT_ACT_ENVIRONMENT = true;

const flush = () => act(async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
});

const row = (id) => ({ id, form_id: 1, form_title: 'Contact', status: 'none', is_read: 0, starred: 0, created_at: '2026-10-01 10:00:00', payload: {} });
const list = (total) => ({
  ok: true,
  status: 200,
  headers: { get: () => String(total) },
  body: { data: [row(1), row(2)], meta: { total } },
});

let host;
let root;
const render = (props) => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root.render(<SubmissionsTable {...props} />));
};
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  document.body.innerHTML = '';
});

const status = () => host.querySelector('[role="status"]');
const tickAll = async () => {
  act(() => host.querySelector('input[aria-label="Select all"]').click());
  await flush();
};
const buttonByText = (text) =>
  Array.from(document.body.querySelectorAll('button')).find((b) => b.textContent.trim() === text || b.getAttribute('aria-label') === text);

beforeEach(() => {
  apiGet.mockReset();
  apiClient.post.mockReset();
  apiClient.post.mockResolvedValue({ affected: 5000 });
});

describe('select all matching (#143)', () => {
  test('the bar shows only when the page is fully selected and more entries match', async () => {
    apiGet.mockResolvedValue(list(4991));
    render({ statusFilter: 'unread' });
    await flush();
    expect(status()).toBeNull();
    await tickAll();
    expect(status().textContent).toContain('All 2 entries on this page are selected.');
    expect(status().textContent).toContain(`Select all ${(4991).toLocaleString()} entries that match this view.`);
  });

  test('no bar when everything that matches is on the page', async () => {
    apiGet.mockResolvedValue(list(2));
    render({});
    await flush();
    await tickAll();
    expect(status()).toBeNull();
  });

  test('clicking the link selects all; a non-destructive action sends match and filters, not ids', async () => {
    apiGet.mockResolvedValue(list(4991));
    render({ statusFilter: 'unread', searchTerm: 'ann', formId: 3 });
    await flush();
    await tickAll();
    act(() => buttonByText(`Select all ${(4991).toLocaleString()} entries that match this view.`).click());
    expect(status().textContent).toContain(`All ${(4991).toLocaleString()} entries that match this view are selected.`);
    expect(buttonByText('Clear selection')).toBeDefined();
    act(() => buttonByText('Mark read').click());
    await flush();
    expect(document.body.textContent).not.toContain('Apply this to');
    expect(apiClient.post).toHaveBeenCalledTimes(1);
    const [path, body] = apiClient.post.mock.calls[0];
    expect(path).toBe('/submissions/bulk');
    expect(body).toEqual({ match: true, action: 'read', form_id: 3, status: 'unread', search: 'ann' });
    expect(body.ids).toBeUndefined();
    expect(status()).toBeNull();
  });

  test('a destructive action asks first and runs only on Apply', async () => {
    apiGet.mockResolvedValue(list(4991));
    render({});
    await flush();
    await tickAll();
    act(() => buttonByText(`Select all ${(4991).toLocaleString()} entries that match this view.`).click());
    act(() => buttonByText('Move to Trash').click());
    await flush();
    expect(document.body.textContent).toContain(`Apply this to ${(4991).toLocaleString()} entries?`);
    expect(apiClient.post).not.toHaveBeenCalled();
    act(() => buttonByText('Cancel').click());
    expect(apiClient.post).not.toHaveBeenCalled();
    act(() => buttonByText('Move to Trash').click());
    await flush();
    act(() => buttonByText('Apply').click());
    await flush();
    expect(apiClient.post.mock.calls[0][1]).toEqual({ match: true, action: 'trash' });
  });

  test('a new search ends the all matching state', async () => {
    apiGet.mockResolvedValue(list(4991));
    render({ searchTerm: '' });
    await flush();
    await tickAll();
    act(() => buttonByText(`Select all ${(4991).toLocaleString()} entries that match this view.`).click());
    expect(status().textContent).toContain('that match this view are selected.');
    act(() => root.render(<SubmissionsTable searchTerm='bob' />));
    await flush();
    expect(host.textContent).not.toContain('that match this view are selected.');
  });
});
