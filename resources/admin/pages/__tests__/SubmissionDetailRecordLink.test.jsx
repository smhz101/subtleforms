/**
 * An action line that carries `link_url` and `link_label` in its data (HubSpot
 * does after a contact was sent) shows an "Open in HubSpot" link in a new tab
 * once the card is opened. An address that is not https is not linked.
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

function logRow(data) {
  return {
    id: 1,
    level: 'info',
    message: 'HubSpot: contact created',
    created_at: '2026-01-01 10:00:00',
    context: { step_id: 'hubspot', action_type: 'hubspot', status: 'succeeded', data: { summary: 'HubSpot: contact created', contact_id: '9001', ...data } },
  };
}

async function mountWith(data) {
  apiClient.get.mockImplementation((path) => {
    if (path.endsWith('/logs')) return Promise.resolve([logRow(data)]);
    if (path.includes('/adjacent')) return Promise.resolve({ next: null, prev: null });
    return Promise.resolve({ data: { id: 7, form_id: 3, status: 'completed', is_read: 1, starred: 0, created_at: '2026-01-01 10:00:00', data: { name: 'Ada' }, meta: {} } });
  });
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => { root.render(<SubmissionDetailPage submissionId={7} formId={3} onBack={() => {}} />); });
  await flush();
  const head = container.querySelector('.sf-pipe-step__head');
  await act(async () => { head.click(); });
  return { container, unmount: () => { act(() => root.unmount()); container.remove(); } };
}

describe('record link on an action line', () => {
  beforeEach(() => { apiClient.get.mockReset(); });

  test('shows Open in HubSpot in a new tab and hides the link keys from the details', async () => {
    const { container, unmount } = await mountWith({
      link_url: 'https://app.hubspot.com/contacts/4455667/record/0-1/9001',
      link_label: 'Open in HubSpot',
    });
    const link = container.querySelector('.sf-pipe-step__open a');
    expect(link.getAttribute('href')).toBe('https://app.hubspot.com/contacts/4455667/record/0-1/9001');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link.textContent).toContain('Open in HubSpot');
    const keys = [...container.querySelectorAll('.sf-pipe-data__key')].map((k) => k.textContent);
    expect(keys).toContain('contact id');
    expect(keys).not.toContain('link url');
    expect(keys).not.toContain('link label');
    unmount();
  });

  test('draws no link for an address that is not https', async () => {
    const { container, unmount } = await mountWith({ link_url: 'javascript:alert(1)', link_label: 'Open in HubSpot' });
    expect(container.querySelector('.sf-pipe-step__open')).toBeNull();
    unmount();
  });
});
