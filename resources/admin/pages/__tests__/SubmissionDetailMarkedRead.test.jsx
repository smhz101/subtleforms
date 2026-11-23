/**
 * Opening an unread entry tells the list once, so the Unread count follows
 * (issue 130).
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';

jest.mock('../SubmissionDetailPage.scss', () => ({}));
jest.mock('../../components/AdminShell', () => {
  const Shell = ({ children, actions }) => <div><div className='actions'>{ actions }</div>{ children }</div>;
  Shell.displayName = 'AdminShellMock';
  return Shell;
});
jest.mock('react-router-dom', () => ({ useNavigate: () => () => {} }));
jest.mock('../../data', () => ({
  apiClient: { get: jest.fn(), put: jest.fn() },
}));

import { apiClient } from '../../data';
import SubmissionDetailPage from '../SubmissionDetailPage';

global.IS_REACT_ACT_ENVIRONMENT = true;

const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

async function open(extra) {
  const onEntryUpdated = jest.fn();
  apiClient.get.mockImplementation((path) => {
    if (path.endsWith('/logs')) return Promise.resolve([]);
    if (path.includes('/adjacent')) return Promise.resolve({ next: null, prev: null });
    return Promise.resolve({
      data: { id: 7, form_id: 3, status: 'completed', is_read: 1, starred: 0, created_at: '2026-01-01 10:00:00', data: {}, meta: {}, ...extra },
    });
  });
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<SubmissionDetailPage submissionId={7} formId={3} onBack={() => {}} onEntryUpdated={onEntryUpdated} />);
  });
  await flush();
  act(() => root.unmount());
  container.remove();
  return onEntryUpdated;
}

describe('marked_read on opening an entry (issue 130)', () => {
  beforeEach(() => { apiClient.get.mockReset(); });

  test('marked_read triggers one onEntryUpdated call from unread to read', async () => {
    const onEntryUpdated = await open({ marked_read: true });
    expect(onEntryUpdated).toHaveBeenCalledTimes(1);
    const [before, after] = onEntryUpdated.mock.calls[0];
    expect(before.is_read).toBe(0);
    expect(after.is_read).toBe(1);
    expect(before.id).toBe(7);
  });

  test('no marked_read means no onEntryUpdated call', async () => {
    const onEntryUpdated = await open({});
    expect(onEntryUpdated).not.toHaveBeenCalled();
  });
});
