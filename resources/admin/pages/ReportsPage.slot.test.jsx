/**
 * Reports keeps entry counts and the chart. Form analytics (views,
 * conversion, funnel) is a Pro card until SubtleForms Pro registers panels in
 * the `reports.panels` slot.
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';

jest.mock('./DashboardPage.scss', () => ({}));
jest.mock('../ui/ProNotice.scss', () => ({}));
jest.mock('../components/AdminShell', () => ({ children, title }) => (
  <div data-title={title}>{children}</div>
));
jest.mock('../utils/api', () => ({ apiGet: jest.fn() }));

import { apiGet } from '../utils/api';
import ReportsPage from './ReportsPage';
import { registerSlotItem } from '../../shared/extend';

global.IS_REACT_ACT_ENVIRONMENT = true;

const overview = {
  total_forms: 3,
  total_submissions: 40,
  unread_submissions: 2,
  forms: [{ id: 1, title: 'Contact' }],
  series: [{ date: '2026-10-01', count: 4 }, { date: '2026-10-02', count: 6 }],
};

async function mount() {
  apiGet.mockResolvedValue({ ok: true, body: { data: overview } });
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<ReportsPage />);
  });
  await act(async () => {});
  return { container, unmount: () => { act(() => root.unmount()); container.remove(); } };
}

afterEach(() => {
  window.__subtleformsExtend.slots = {};
  delete window.subtleformsAdmin;
});

test('shows entry counts and the chart, and asks the server for nothing about views', async () => {
  const { container, unmount } = await mount();
  expect(container.textContent).toContain('Submissions');
  expect(container.querySelector('.sf-trend')).not.toBeNull();
  expect(apiGet.mock.calls.map((c) => c[0])).toEqual(['/reports/overview']);
  unmount();
});

test('shows a Pro card for analytics, with an upgrade link', async () => {
  window.subtleformsAdmin = { proUrl: 'https://example.test/pro' };
  const { container, unmount } = await mount();
  const card = container.querySelector('.sf-pro-notice');
  expect(card).not.toBeNull();
  expect(container.textContent).toContain('Form analytics');
  expect(container.textContent).not.toMatch(/Conversion is submissions divided by views/);
  expect(card.querySelector('a').getAttribute('href')).toContain('extensions.analytics');
  unmount();
});

test('draws the panels SubtleForms Pro registers, in place of the card', async () => {
  registerSlotItem('reports.panels', 'analytics', {
    component: ({ forms }) => <section className='pro-panel'>{forms.length} forms</section>,
  });
  const { container, unmount } = await mount();
  expect(container.querySelector('.pro-panel').textContent).toBe('1 forms');
  expect(container.querySelector('.sf-pro-notice')).toBeNull();
  unmount();
});
