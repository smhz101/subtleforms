/**
 * A step that succeeded with a note (a notification sent without its
 * conditions being checked, #137) shows the note as a muted line, never in
 * the red Error section.
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';

jest.mock('../SubmissionDetailPage.scss', () => ({}));
jest.mock('../../components/AdminShell', () => {
  const Shell = ({ children }) => <div>{ children }</div>;
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

const NOTE = 'Sent without checking its conditions: SubtleForms Pro, which checks them, is not active.';

const log = (status, error) => ({
  level: 'info',
  created_at: '2026-01-01 10:00:00',
  context: { step_id: 'action:email:1', action_type: 'email', status, error, data: {} },
});

async function mountWithLogs(logs) {
  apiClient.get.mockImplementation((path) => {
    if (path.endsWith('/logs')) return Promise.resolve(logs);
    if (path.includes('/adjacent')) return Promise.resolve({ next: null, prev: null });
    return Promise.resolve({ data: { id: 7, form_id: 3, status: 'completed', is_read: 1, starred: 0, created_at: '2026-01-01 10:00:00', data: { name: 'Ada' }, meta: {} } });
  });
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => { root.render(<SubmissionDetailPage submissionId={7} formId={3} onBack={() => {}} />); });
  await flush();
  return { container, unmount: () => { act(() => root.unmount()); container.remove(); } };
}

describe('a succeeded step with a note (#137)', () => {
  beforeEach(() => { apiClient.get.mockReset(); });

  test('shows the note neutrally and no Error section', async () => {
    const { container, unmount } = await mountWithLogs([log('started', null), log('succeeded', NOTE)]);
    const note = container.querySelector('.sf-pipe-step__skip-note');
    expect(note).toBeTruthy();
    expect(note.textContent).toBe(NOTE);
    expect(container.querySelector('.sf-pipe-step--succeeded')).toBeTruthy();
    expect(container.querySelector('.sf-pipe-step__section--error')).toBeNull();
    expect(container.querySelector('.sf-pipe-error-msg')).toBeNull();
    unmount();
  });

  test('a succeeded step without a note shows none', async () => {
    const { container, unmount } = await mountWithLogs([log('started', null), log('succeeded', null)]);
    expect(container.querySelector('.sf-pipe-step__skip-note')).toBeNull();
    unmount();
  });
});
