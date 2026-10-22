jest.mock('./analytics.scss', () => ({}));
jest.mock('../../pages/DashboardPage.scss', () => ({}));
jest.mock('../../pages/ReportsPage.scss', () => ({}));
jest.mock('../AdminShell', () => function AdminShell({ children }) {
  return <div>{children}</div>;
});
jest.mock('../../utils/api', () => ({ apiGet: jest.fn(() => new Promise(() => {})) }));
jest.mock('./useAnalytics', () => ({
  ANALYTICS_DAYS: 30,
  useAnalyticsSeries: () => ({ data: null, isLoading: false, error: null }),
  useAnalyticsSummary: () => ({ data: null, isLoading: false, error: null }),
  useFunnel: () => ({ data: null, isLoading: false, error: null }),
  formatRate: (n) => `${n}%`,
}));

import { createRoot } from '@wordpress/element';
import { act } from 'react';
import { FunnelBody, FUNNEL_TOP_FIELDS, FUNNEL_TOP_STEPS } from './FunnelPanel';
import { reportRows, REPORT_TOP_FORMS } from '../../pages/ReportsPage';

global.IS_REACT_ACT_ENVIRONMENT = true;

function render(element) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(element));
  return {
    container,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

const many = (n, make) => Array.from({ length: n }, (_, i) => make(i));

const REPORT = {
  tracking: true,
  form_tracked: true,
  seen: 1000,
  started: 600,
  submitted: 300,
  left: 300,
  fields: many(12, (i) => ({ key: `f${i}`, label: `Field ${i}`, type: 'text', count: 100 - i, known: true })),
  steps: many(8, (i) => ({ index: i, label: `Step ${i}`, count: 50 - i })),
};

const button = (container, text) =>
  [...container.querySelectorAll('button')].find((el) => el.textContent === text);

describe('long report lists show their top rows and a Show all button', () => {
  it('shows the top fields and steps, then all of them, then fewer again', () => {
    const { container, unmount } = render(<FunnelBody report={REPORT} days={30} />);
    expect(container.querySelectorAll('.sf-funnel__drop')).toHaveLength(FUNNEL_TOP_FIELDS);
    expect(container.querySelectorAll('.sf-funnel__steps li')).toHaveLength(FUNNEL_TOP_STEPS);
    // The busiest field comes first.
    expect(container.querySelector('.sf-funnel__drop-name').textContent).toBe('Field 0');

    const fields = button(container, 'Show all 12 fields');
    expect(fields.getAttribute('aria-expanded')).toBe('false');
    expect(fields.getAttribute('aria-controls')).toBe('sf-funnel-drops');
    act(() => fields.click());
    expect(container.querySelectorAll('.sf-funnel__drop')).toHaveLength(12);
    const fewer = button(container, 'Show fewer fields');
    expect(fewer.getAttribute('aria-expanded')).toBe('true');

    act(() => button(container, 'Show all 8 steps').click());
    expect(container.querySelectorAll('.sf-funnel__steps li')).toHaveLength(8);

    act(() => fewer.click());
    expect(container.querySelectorAll('.sf-funnel__drop')).toHaveLength(FUNNEL_TOP_FIELDS);
    unmount();
  });

  it('has no button when every row fits', () => {
    const short = { ...REPORT, fields: REPORT.fields.slice(0, 3), steps: REPORT.steps.slice(0, 2) };
    const { container, unmount } = render(<FunnelBody report={short} days={30} />);
    expect(container.querySelectorAll('.sf-funnel__drop')).toHaveLength(3);
    expect(container.querySelector('.sf-show-all')).toBeNull();
    unmount();
  });
});

describe('Each form, last 30 days', () => {
  it('lists the most viewed forms first, with their titles', () => {
    const forms = [
      { id: 1, title: 'Quiet' },
      { id: 2, title: 'Busy' },
      { id: 3, title: 'Middle' },
    ];
    const summary = {
      1: { form_id: 1, views: 5, submissions: 1 },
      2: { form_id: 2, views: 50, submissions: 3 },
      3: { form_id: 3, views: 5, submissions: 2 },
      4: { form_id: 4, views: 0, submissions: 0 },
    };
    expect(reportRows(summary, forms).map((r) => r.title)).toEqual(['Busy', 'Middle', 'Quiet', 'Form #4']);
    expect(REPORT_TOP_FORMS).toBeGreaterThan(0);
  });
});
