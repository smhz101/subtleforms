/**
 * Not spam on the entry panel, for spam entries only (#131).
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
  apiClient: { get: jest.fn(), put: jest.fn(), post: jest.fn() },
}));

import { apiClient } from '../../data';
import SubmissionDetailPage from '../SubmissionDetailPage';

global.IS_REACT_ACT_ENVIRONMENT = true;

const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

function entry(status) {
  return {
    id: 7,
    form_id: 3,
    status,
    is_read: 1,
    starred: 0,
    created_at: '2026-01-01 10:00:00',
    data: { name: 'Ada' },
    meta: {},
  };
}

async function mountWith(status) {
  apiClient.get.mockImplementation((path) => {
    if (path.endsWith('/logs')) return Promise.resolve([]);
    if (path.includes('/adjacent')) return Promise.resolve({ next: null, prev: null });
    return Promise.resolve({ data: entry(status) });
  });
  apiClient.put.mockResolvedValue({});
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => { root.render(<SubmissionDetailPage submissionId={7} formId={3} onBack={() => {}} onEntryUpdated={global.__updated} />); });
  await flush();
  return { container, unmount: () => { act(() => root.unmount()); container.remove(); } };
}

const button = (container, name) =>
  Array.from(container.querySelectorAll('button')).find((b) => b.textContent.trim() === name);

describe('Not spam on the entry panel (#131)', () => {
  beforeEach(() => {
    apiClient.get.mockReset();
    apiClient.put.mockReset();
    apiClient.post.mockReset();
    global.__updated = jest.fn();
  });

  test('a spam entry shows Not spam, which restores it and refreshes counts', async () => {
    apiClient.post.mockResolvedValue({ updated: [7] });
    const { container, unmount } = await mountWith('spam');
    const btn = button(container, 'Not spam');
    expect(btn).toBeTruthy();
    await act(async () => { btn.click(); });
    await flush();
    expect(apiClient.post).toHaveBeenCalledWith('/submissions/bulk', { ids: [7], action: 'restore' });
    expect(global.__updated).toHaveBeenCalled();
    expect(button(container, 'Not spam')).toBeUndefined();
    unmount();
  });

  test('other entries have no Not spam', async () => {
    const { container, unmount } = await mountWith('completed');
    expect(button(container, 'Not spam')).toBeUndefined();
    unmount();
  });
});
