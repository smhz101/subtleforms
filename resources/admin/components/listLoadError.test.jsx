/**
 * UX2-05: a list that cannot load says so and offers Retry. It does not
 * show an empty list as if there were nothing there, and Retry loads it.
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';

jest.mock('./FormsList.scss', () => ({}));
jest.mock('./SubmissionsTable.scss', () => ({}));
jest.mock('./DataTable.scss', () => ({}));
// The notices store is a webpack external; give the test a tiny real one.
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
jest.mock('./analytics/useAnalytics', () => ({
  useAnalyticsSummary: () => ({ data: null, loading: false }),
}));
jest.mock('./analytics/PerformanceCell', () => () => null);

import { apiGet } from '../utils/api';
import FormsList from './FormsList';
import SubmissionsTable from './SubmissionsTable';

global.IS_REACT_ACT_ENVIRONMENT = true;

const flush = () => act(async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
});

function mount(element) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(element));
  return { container, unmount: () => { act(() => root.unmount()); container.remove(); } };
}

const failure = { ok: false, status: 500, body: null, headers: null };
const success = (rows) => ({
  ok: true,
  status: 200,
  headers: { get: () => String(rows.length) },
  body: { data: rows, meta: { total: rows.length } },
});

const retryButton = (container) => [...container.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Retry');

beforeEach(() => {
  apiGet.mockReset();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  console.error.mockRestore();
});

describe('Forms list load error (UX2-05)', () => {
  test('a failed load shows an alert with Retry, not an empty list', async () => {
    apiGet.mockResolvedValue(failure);
    const { container, unmount } = mount(<FormsList />);
    await flush();
    const alert = container.querySelector('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(alert.textContent).toContain('Forms could not be loaded.');
    expect(container.textContent).not.toContain('Create your first form');
    expect(retryButton(container)).toBeDefined();
    unmount();
  });

  test('Retry loads the forms', async () => {
    apiGet.mockResolvedValueOnce(failure);
    apiGet.mockResolvedValue(success([{ id: 7, title: 'Contact us', status: 'published', form_type: 'regular', updated_at: '2026-10-01 10:00:00', created_at: '2026-10-01 10:00:00' }]));
    const { container, unmount } = mount(<FormsList />);
    await flush();
    act(() => retryButton(container).click());
    await flush();
    expect(container.textContent).toContain('Contact us');
    expect(container.querySelector('[role="alert"]')).toBeNull();
    unmount();
  });
});

describe('Entries table load error (UX2-05)', () => {
  test('a failed load shows an alert with Retry', async () => {
    apiGet.mockResolvedValue(failure);
    const { container, unmount } = mount(<SubmissionsTable />);
    await flush();
    const alert = container.querySelector('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(alert.textContent).toContain('Entries could not be loaded.');
    expect(retryButton(container)).toBeDefined();
    unmount();
  });

  test('Retry asks the server again', async () => {
    apiGet.mockResolvedValueOnce(failure);
    apiGet.mockResolvedValue(success([]));
    const { container, unmount } = mount(<SubmissionsTable />);
    await flush();
    const callsBefore = apiGet.mock.calls.length;
    act(() => retryButton(container).click());
    await flush();
    expect(apiGet.mock.calls.length).toBeGreaterThan(callsBefore);
    expect(container.querySelector('.sf-submissions-table__error')).toBeNull();
    unmount();
  });
});
