/**
 * The entry panel header and its activity log show the same time for the
 * same instant, in the site time zone (not the browser's).
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
import { formatSiteDateTime } from '../../utils/formatDate';

global.IS_REACT_ACT_ENVIRONMENT = true;

const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

const CREATED = '2026-11-20 11:07:17';

async function mount() {
  apiClient.get.mockImplementation((path) => {
    if (path.endsWith('/logs')) {
      return Promise.resolve([
        { level: 'info', message: 'Entry stored', created_at: CREATED, context: {} },
      ]);
    }
    if (path.includes('/adjacent')) return Promise.resolve({ next: null, prev: null });
    return Promise.resolve({
      data: {
        id: 9, form_id: 3, status: 'completed', is_read: 1, starred: 0,
        created_at: CREATED, data: { name: 'Ada' }, meta: {},
      },
    });
  });
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => { root.render(<SubmissionDetailPage submissionId={9} formId={3} onBack={() => {}} />); });
  await flush();
  return { container, unmount: () => { act(() => root.unmount()); container.remove(); } };
}

const logTab = (container) =>
  Array.from(container.querySelectorAll('[role="tab"], button')).find((b) =>
    /^Log \(/.test(b.textContent.trim())
  );

const receivedCell = (container) => {
  const dt = Array.from(container.querySelectorAll('dt')).find((d) => d.textContent === 'Received');
  return dt.nextElementSibling;
};

describe('entry panel time zone', () => {
  afterEach(() => { delete window.subtleformsAdmin; });

  test.each([['UTC'], ['Asia/Karachi'], ['+05:30']])(
    'header and log show the same site time for zone %s',
    async (zone) => {
      window.subtleformsAdmin = { timezone: zone };
      const { container, unmount } = await mount();
      const expected = formatSiteDateTime(CREATED);
      const received = receivedCell(container);
      expect(received.textContent).toBe(expected);
      expect(received.getAttribute('title')).toBe(`${expected} (${zone === '+05:30' ? 'UTC+05:30' : zone})`);

      await act(async () => { logTab(container).click(); });
      await flush();
      const cell = container.querySelector('.sf-log-table__time');
      expect(cell).toBeTruthy();
      expect(cell.textContent).toBe(received.textContent);
      expect(cell.textContent).not.toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
      unmount();
    }
  );
});
