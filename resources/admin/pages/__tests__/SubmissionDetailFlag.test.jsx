/**
 * Flag and Flagged on the entry detail screen toggle the entry (COMPAT5-01).
 * The click handler calls nextReviewStatus, which must be imported.
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
  await act(async () => { root.render(<SubmissionDetailPage submissionId={7} formId={3} onBack={() => {}} />); });
  await flush();
  return { container, unmount: () => { act(() => root.unmount()); container.remove(); } };
}

const button = (container, name) =>
  Array.from(container.querySelectorAll('button')).find((b) => b.textContent.trim() === name);

describe('flag toggle on the entry detail (COMPAT5-01)', () => {
  beforeEach(() => { apiClient.get.mockReset(); apiClient.put.mockReset(); });

  test('Flag sends status flagged', async () => {
    const { container, unmount } = await mountWith('completed');
    const flag = button(container, 'Flag');
    expect(flag).toBeTruthy();
    await act(async () => { flag.click(); });
    await flush();
    expect(apiClient.put).toHaveBeenCalledWith('/submissions/7', { status: 'flagged' });
    expect(button(container, 'Flagged')).toBeTruthy();
    unmount();
  });

  test('Flagged sends status none and goes back to Flag', async () => {
    const { container, unmount } = await mountWith('flagged');
    const flagged = button(container, 'Flagged');
    expect(flagged).toBeTruthy();
    await act(async () => { flagged.click(); });
    await flush();
    expect(apiClient.put).toHaveBeenCalledWith('/submissions/7', { status: 'none' });
    expect(button(container, 'Flag')).toBeTruthy();
    unmount();
  });
});
