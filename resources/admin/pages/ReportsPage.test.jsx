/**
 * Reports: date range and export in the page header, a form selector, bars
 * with the period before as a line, a sortable breakdown, a field summary for
 * one form and plain sentences when there is nothing to draw.
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';

jest.mock('./DashboardPage.scss', () => ({}));
jest.mock('./ReportsPage.scss', () => ({}));
jest.mock('../components/AdminShell', () => function AdminShellMock({ children, title, actions, actionBarLeft, isLoading, error }) {
  return (
    <div data-title={title}>
      <div className='mock-actions'>{actions}</div>
      <div className='mock-toolbar'>{actionBarLeft}</div>
      {isLoading ? <p className='mock-loading'>loading</p> : null}
      {error ? <p className='mock-error'>{error}</p> : null}
      {children}
    </div>
  );
});
jest.mock('../data', () => ({ useReport: jest.fn() }));

import { useReport } from '../data';
import ReportsPage, { presetRange, shiftDate, breakdownCsv, changeText } from './ReportsPage';
import { registerSlotItem } from '../../shared/extend';

global.IS_REACT_ACT_ENVIRONMENT = true;

const series = Array.from({ length: 5 }, (_, i) => ({ date: `2026-10-0${i + 1}`, count: i, previous: 4 - i }));

const report = (extra = {}) => ({
  range: { from: '2026-10-01', to: '2026-10-05', days: 5 },
  previous: { from: '2026-09-26', to: '2026-09-30' },
  form_id: 0,
  series,
  totals: { entries: 10, previous_entries: 8, unread: 3, spam: 7 },
  breakdown: [
    { id: 1, title: 'Contact', entries: 6, unread: 1, spam: 2, share: 60, days: [0, 1, 2, 1, 2] },
    { id: 2, title: 'Quote', entries: 4, unread: 2, spam: 5, share: 40, days: [0, 0, 0, 0, 0] },
  ],
  forms: [{ id: 1, title: 'Contact' }, { id: 2, title: 'Quote' }],
  field_summary: [],
  ...extra,
});

let container;
let root;

async function mount(data) {
  useReport.mockReturnValue({ data, isLoading: !data, isError: false, isFetching: false, refetch: jest.fn() });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(<ReportsPage />);
  });
}

beforeEach(() => {
  window.subtleformsAdmin = { siteToday: '2026-10-05' };
  useReport.mockReset();
});

afterEach(() => {
  if (root) {
    act(() => root.unmount());
    container.remove();
    root = null;
  }
  window.__subtleformsExtend.slots = {};
  delete window.subtleformsAdmin;
});

test('date presets end today and count it', () => {
  expect(presetRange('today', '2026-10-05')).toEqual({ from: '2026-10-05', to: '2026-10-05' });
  expect(presetRange('7d', '2026-10-05')).toEqual({ from: '2026-09-29', to: '2026-10-05' });
  expect(presetRange('30d', '2026-10-05')).toEqual({ from: '2026-09-06', to: '2026-10-05' });
  expect(presetRange('90d', '2026-10-05').from).toBe(shiftDate('2026-10-05', -89));
});

test('asks for the last 30 days of all forms first', async () => {
  await mount(report());
  expect(useReport.mock.calls[0][0]).toEqual({ from: '2026-09-06', to: '2026-10-05', formId: 0 });
});

test('the date range and Export CSV are in the page header', async () => {
  await mount(report());
  const actions = container.querySelector('.mock-actions');
  expect(actions.querySelector('select').value).toBe('30d');
  expect([...actions.querySelectorAll('option')].map((o) => o.textContent)).toEqual([
    'Today', 'Last 7 days', 'Last 30 days', 'Last 90 days', 'Custom range',
  ]);
  expect(actions.textContent).toContain('Export CSV');
});

test('choosing Custom range shows two date fields and asks for those dates', async () => {
  await mount(report());
  const select = container.querySelector('.mock-actions select');
  await act(async () => {
    select.value = 'custom';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
  expect(container.querySelectorAll('.mock-actions input[type="date"]')).toHaveLength(2);
});

test('choosing a form asks for that form and shows its field summary', async () => {
  await mount(report());
  const formSelect = container.querySelector('.mock-toolbar select');
  await act(async () => {
    formSelect.value = '1';
    formSelect.dispatchEvent(new Event('change', { bubbles: true }));
  });
  expect(useReport.mock.calls.pop()[0].formId).toBe(1);
  expect(container.querySelector('.sf-reports__fields')).not.toBeNull();
});

test('the field summary draws one distribution per field', async () => {
  useReport.mockReset();
  await mount(
    report({
      form_id: 1,
      field_summary: [
        {
          key: 'plan', label: 'Plan', type: 'radio', kind: 'choice', answered: 10, average: null, sampled: false,
          options: [{ value: 'a', label: 'Basic', count: 6 }, { value: 'b', label: 'Team', count: 4 }],
        },
        {
          key: 'nps', label: 'Score', type: 'rating', kind: 'rating', answered: 4, average: 4.5, sampled: false,
          options: [{ value: '4', label: '4', count: 2 }, { value: '5', label: '5', count: 2 }],
        },
      ],
    })
  );
  // Show the section (a form is chosen).
  const formSelect = container.querySelector('.mock-toolbar select');
  await act(async () => {
    formSelect.value = '1';
    formSelect.dispatchEvent(new Event('change', { bubbles: true }));
  });
  const cards = container.querySelectorAll('.sf-fieldsum');
  expect(cards).toHaveLength(2);
  expect(cards[0].textContent).toContain('Basic');
  expect(cards[0].textContent).toContain('60%');
  expect(cards[1].textContent).toContain('average 4.5');
});

test('the chart draws bars and the previous period as a line', async () => {
  await mount(report());
  expect(container.querySelectorAll('.sf-trend__col')).toHaveLength(5);
  expect(container.querySelector('.sf-trend__previous polyline')).not.toBeNull();
  expect(container.querySelector('.sf-trend__legend').textContent).toContain('Previous period');
});

test('the breakdown lists each form with entries, unread, spam and share, sorted by entries', async () => {
  await mount(report());
  const rows = [...container.querySelectorAll('.sf-data-table tbody tr')];
  expect(rows).toHaveLength(2);
  expect(rows[0].textContent).toContain('Contact');
  expect(rows[0].textContent).toContain('60%');
  expect(rows[0].querySelector('.sf-spark')).not.toBeNull();
  const heads = [...container.querySelectorAll('.sf-data-table th')].map((th) => th.textContent);
  expect(heads).toEqual(expect.arrayContaining(['Form', 'Entries', 'Unread', 'Spam blocked', 'Share', 'Trend']));
});

test('sorting by spam puts the form with the most spam first', async () => {
  await mount(report());
  const spam = [...container.querySelectorAll('.sf-data-table th')].find((th) => th.textContent.startsWith('Spam blocked'));
  await act(async () => spam.click());
  expect(container.querySelector('.sf-data-table tbody tr').textContent).toContain('Quote');
});

test('says so in a sentence when a period has no entries', async () => {
  await mount(
    report({
      series: series.map((d) => ({ ...d, count: 0, previous: 0 })),
      totals: { entries: 0, previous_entries: 0, unread: 0, spam: 0 },
      breakdown: [],
    })
  );
  expect(container.textContent).toContain('No entries in this period.');
  expect(container.querySelector('.sf-trend')).toBeNull();
  expect(container.textContent).toContain('No forms received entries in this period.');
  expect(container.querySelector('.mock-actions button[aria-disabled="true"], .mock-actions button:disabled')).not.toBeNull();
});

test('add-ons add series and panels', async () => {
  registerSlotItem('reports.series', 'views', { component: ({ report: r }) => <section className='addon-series'>{r.range.days} days</section> });
  registerSlotItem('reports.panels', 'p', { component: ({ forms }) => <section className='pro-panel'>{forms.length} forms</section> });
  await mount(report());
  expect(container.querySelector('.addon-series').textContent).toBe('5 days');
  expect(container.querySelector('.pro-panel').textContent).toBe('2 forms');
});

test('add-ons add columns to the breakdown, before the trend', async () => {
  registerSlotItem('reports.breakdown.column', 'views', {
    header: 'Views',
    component: ({ form, range }) => <span className='addon-cell'>{form.title}:{range.to}</span>,
  });
  await mount(report());
  const heads = [...container.querySelectorAll('th')].map((th) => th.textContent.trim());
  expect(heads.indexOf('Views')).toBeGreaterThan(heads.indexOf('Share'));
  expect(heads.indexOf('Views')).toBeLessThan(heads.indexOf('Trend'));
  expect(container.querySelectorAll('.addon-cell').length).toBeGreaterThan(0);
});

test('shows no upgrade link without an add-on', async () => {
  await mount(report());
  expect(container.textContent).not.toMatch(/\bPro\b|upgrade|licen/i);
  expect(container.querySelectorAll('a[href*="subtleforms.com"]').length).toBe(0);
});

test('CSV has a header, one line per form and guards formulas', () => {
  const csv = breakdownCsv([
    { title: '=SUM(A1)', entries: 2, unread: 1, spam: 0, share: 50 },
    { title: 'Say "hi", now', entries: 2, unread: 0, spam: 1, share: 50 },
  ]);
  const lines = csv.split('\n');
  expect(lines[0]).toBe('Form,Entries,Unread,Spam blocked,Share of total (%)');
  expect(lines[1]).toBe("'=SUM(A1),2,1,0,50");
  expect(lines[2]).toBe('"Say ""hi"", now",2,0,1,50');
});

test('changeText compares with the period before', () => {
  expect(changeText(12, 10)).toBe('+20% from the period before');
  expect(changeText(5, 5)).toBe('Same as the period before');
  expect(changeText(3, 0)).toBe('None in the period before');
  expect(changeText(0, 0)).toBe('No entries in either period');
});

test('shows a loading state before the first answer', async () => {
  await mount(undefined);
  expect(container.querySelector('.mock-loading')).not.toBeNull();
});
