/**
 * Reports keeps entry counts and the chart. Add-ons draw more panels in the
 * `reports.panels` slot; without one nothing else is shown (no locked card).
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';

jest.mock('./DashboardPage.scss', () => ({}));
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

test('shows no analytics card and no upgrade link without an add-on', async () => {
  const { container, unmount } = await mount();
  expect(container.textContent).not.toContain('Form analytics');
  expect(container.textContent).not.toMatch(/\bPro\b|upgrade|licen/i);
  expect(container.querySelectorAll('a[href*="subtleforms.com"]').length).toBe(0);
  unmount();
});

test('draws the panels an add-on registers', async () => {
  registerSlotItem('reports.panels', 'analytics', {
    component: ({ forms }) => <section className='pro-panel'>{forms.length} forms</section>,
  });
  const { container, unmount } = await mount();
  expect(container.querySelector('.pro-panel').textContent).toBe('1 forms');
  unmount();
});
