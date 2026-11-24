/**
 * The bulk bar offers Not spam on the Spam tab, in place of Mark as spam (#131).
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';

jest.mock('./SubmissionsTable.scss', () => ({}));
jest.mock('./DataTable', () => {
  const Table = (props) => {
    global.__bulkActions = props.bulkActions;
    return null;
  };
  Table.displayName = 'DataTableMock';
  return Table;
});
jest.mock('../utils/api', () => ({ apiGet: jest.fn(() => Promise.resolve({ data: [], total: 0 })) }));
jest.mock('../data', () => ({
  apiClient: { get: jest.fn(() => Promise.resolve({})), post: jest.fn(() => Promise.resolve({ updated: [5] })) },
  useSettings: () => ({ data: {} }),
}));
jest.mock('../ui', () => ({ Icon: new Proxy({}, { get: () => () => null }) }));
jest.mock(
  '@wordpress/notices',
  () => {
    const { createReduxStore, register } = require('@wordpress/data');
    const store = createReduxStore('core/notices', {
      reducer: (state = {}) => state,
      actions: { createSuccessNotice: () => ({ type: 'x' }), createErrorNotice: () => ({ type: 'x' }) },
    });
    register(store);
    return { store };
  },
  { virtual: true }
);
jest.mock('./SubmissionRowActions', () => () => null);

import { apiClient } from '../data';
import SubmissionsTable from './SubmissionsTable';

global.IS_REACT_ACT_ENVIRONMENT = true;

async function bulkLabels(statusFilter) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<SubmissionsTable statusFilter={statusFilter} />);
  });
  const actions = global.__bulkActions;
  act(() => root.unmount());
  container.remove();
  return actions;
}

describe('Not spam bulk action (#131)', () => {
  test('the Spam tab shows Not spam and not Mark as spam', async () => {
    const actions = await bulkLabels('spam');
    const labels = actions.map((a) => a.label);
    expect(labels).toContain('Not spam');
    expect(labels).not.toContain('Mark as spam');
  });

  test('other tabs keep Mark as spam and have no Not spam', async () => {
    const labels = (await bulkLabels('all')).map((a) => a.label);
    expect(labels).toContain('Mark as spam');
    expect(labels).not.toContain('Not spam');
  });

  test('Not spam runs the restore action', async () => {
    const actions = await bulkLabels('spam');
    await act(async () => {
      await actions.find((a) => a.label === 'Not spam').onClick([5]);
    });
    expect(apiClient.post).toHaveBeenCalledWith('/submissions/bulk', { ids: [5], action: 'restore' });
  });
});
