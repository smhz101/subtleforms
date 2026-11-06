/**
 * Dashboard: four tiles that open the matching Submissions view, the chart
 * with its 7/30/90 choice, what needs attention, recent entries, top forms,
 * the Getting started list and the slots add-ons use. Every figure is read from the
 * one dashboard query (the page mocks that single hook).
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';
import { registerSlotItem } from '../../shared/extend';

jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn() }));
jest.mock('./DashboardPage.scss', () => ({}));
jest.mock('../components/AdminShell', () => function AdminShellMock({ children, title, actions }) {
  return (
    <div data-title={title}>
      <div className='mock-actions'>{actions}</div>
      {children}
    </div>
  );
});
jest.mock('../components/SpamProtectionNotice', () => () => null);
jest.mock('../components/MoreFeaturesCard', () => () => null);
jest.mock('../data', () => ({ useDashboardStats: jest.fn() }));

import { useDashboardStats } from '../data';
import Dashboard, { deltaText } from './DashboardPage';

global.IS_REACT_ACT_ENVIRONMENT = true;

const day = (n) => {
  const d = new Date(Date.UTC(2026, 9, 1));
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const trend = Array.from({ length: 90 }, (_, i) => ({ date: day(i), count: i % 3 === 0 ? 2 : 0 }));

const base = () => ({
  stats: {
    total_forms: 3,
    published_forms: 2,
    submissions_today: 4,
    submissions_this_week: 12,
    submissions_prev_week: 10,
    unread_submissions: 5,
    spam_blocked_week: 31,
  },
  trend,
  recent_submissions: [
    { id: 9, form_title: 'Contact', name: 'Ada Lovelace', email: 'ada@example.com', is_read: false, time_ago: '5 mins' },
    { id: 8, form_title: 'Quote', name: '', email: 'bob@example.com', is_read: true, time_ago: '1 hour' },
  ],
  recent_forms: [],
  top_forms: [{ id: 1, title: 'Contact', entries: 17 }],
  attention: { unread: 5, idle_forms: { count: 1, forms: [{ id: 2, title: 'Quiet form' }] }, integration_failures: 2 },
  checklist: { show: false, steps: [] },
  system_health: { status: 'healthy' },
});

let container;
let root;

async function mount(data) {
  useDashboardStats.mockReturnValue({ data, isLoading: false, error: null, refetch: jest.fn() });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(<Dashboard />);
  });
}

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  window.__subtleformsExtend.slots = {};
});

const hrefs = () => [...container.querySelectorAll('.sf-kpi')].map((el) => el.getAttribute('href'));

test('four tiles, each linking to the filtered Submissions view', async () => {
  await mount(base());
  const tiles = [...container.querySelectorAll('.sf-kpi')];
  expect(tiles.map((t) => t.querySelector('.sf-kpi__label').textContent)).toEqual([
    'Entries today',
    'Entries, last 7 days',
    'Unread',
    'Spam blocked, last 7 days',
  ]);
  expect(tiles.map((t) => t.querySelector('.sf-kpi__value').textContent)).toEqual(['4', '12', '5', '31']);
  expect(hrefs()).toEqual([
    '/submissions?range=today',
    '/submissions?range=7days',
    '/submissions?tab=unread',
    '/submissions?tab=spam',
  ]);
});

test('the 7 day tile shows the change from the week before', async () => {
  await mount(base());
  expect(container.querySelectorAll('.sf-kpi')[1].textContent).toContain('+20% from the week before');
});

test('deltaText covers no change, a drop, and a first week', () => {
  expect(deltaText(5, 5).tone).toBe('flat');
  expect(deltaText(3, 6)).toEqual({ text: '-50% from the week before', tone: 'down' });
  expect(deltaText(2, 0).text).toBe('New this week');
  expect(deltaText(0, 0).tone).toBe('flat');
});

test('the chart defaults to 30 days and switches to 7 and 90', async () => {
  await mount(base());
  const title = () => container.querySelector('.sf-panel__title').textContent;
  const bars = () => container.querySelectorAll('.sf-trend__col').length;
  expect(container.textContent).toContain('Submissions, last 30 days');
  expect(bars()).toBe(30);
  const button = (label) => [...container.querySelectorAll('.sf-range__option')].find((b) => b.textContent === label);
  await act(async () => button('7 days').click());
  expect(bars()).toBe(7);
  expect(container.textContent).toContain('Submissions, last 7 days');
  await act(async () => button('90 days').click());
  expect(bars()).toBe(90);
  expect(button('90 days').getAttribute('aria-pressed')).toBe('true');
  expect(title()).toBeTruthy();
});

test('needs attention lists unread, quiet forms and integration failures', async () => {
  await mount(base());
  const text = container.querySelector('.sf-attn').textContent;
  expect(text).toContain('5unread entries');
  expect(text).toContain('1published form with no entries in 30 days');
  expect(text).toContain('Quiet form');
  expect(text).toContain('2integration failures in the last 7 days');
});

test('needs attention says so when there is nothing', async () => {
  const data = base();
  data.attention = { unread: 0, idle_forms: { count: 0, forms: [] }, integration_failures: 0 };
  await mount(data);
  expect(container.textContent).toContain('Nothing needs attention.');
});

test('recent entries show the form, who sent it, the time and an unread dot', async () => {
  await mount(base());
  const rows = [...container.querySelectorAll('.sf-list__row')];
  expect(rows).toHaveLength(2);
  expect(rows[0].textContent).toContain('Contact');
  expect(rows[0].textContent).toContain('Ada Lovelace');
  expect(rows[0].textContent).toContain('ada@example.com');
  expect(rows[0].textContent).toContain('5 mins ago');
  expect(rows[0].querySelector('.sf-list__marker').classList.contains('is-unread')).toBe(true);
  expect(rows[1].querySelector('.sf-list__marker').classList.contains('is-unread')).toBe(false);
  expect(rows[1].textContent).toContain('bob@example.com');
});

test('top forms list entries in the last 30 days', async () => {
  await mount(base());
  expect(container.querySelector('.sf-top').textContent).toContain('Contact17');
});

test('Getting started shows only while the site needs it', async () => {
  const data = base();
  data.checklist = {
    show: true,
    steps: [
      { id: 'create_form', done: true },
      { id: 'add_to_page', done: false },
      { id: 'notification_email', done: false },
      { id: 'spam_protection', done: false },
    ],
  };
  await mount(data);
  expect(container.querySelector('.sf-start')).not.toBeNull();
  expect(container.querySelectorAll('.sf-start__item')).toHaveLength(4);
  expect(container.querySelectorAll('.sf-start__item.is-done')).toHaveLength(1);
  expect(container.textContent).toContain('1 of 4 done');
});

test('Getting started is absent once the site has a form and an entry', async () => {
  await mount(base());
  expect(container.querySelector('.sf-start')).toBeNull();
});

test('add-ons draw tiles, widgets, attention rows and a top forms column', async () => {
  registerSlotItem('dashboard.tiles', 't', { component: () => <div className='addon-tile'>tile</div> });
  registerSlotItem('dashboard.widgets', 'w', { component: ({ data }) => <section className='addon-widget'>{data.stats.total_forms}</section> });
  registerSlotItem('dashboard.attention', 'a', { component: () => <li className='addon-attn'>2 payments pending</li> });
  registerSlotItem('dashboard.top_forms.column', 'c', {
    header: 'Conversion',
    component: ({ form }) => <span className='addon-cell'>{form.entries}%</span>,
  });
  await mount(base());
  expect(container.querySelector('.addon-tile')).not.toBeNull();
  expect(container.querySelector('.addon-widget').textContent).toBe('3');
  expect(container.querySelector('.sf-attn .addon-attn').textContent).toBe('2 payments pending');
  expect(container.querySelector('.addon-cell').textContent).toBe('17%');
  expect(container.querySelector('.sf-top thead').textContent).toContain('Conversion');
});
