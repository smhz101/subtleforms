jest.mock('./analytics.scss', () => ({}));
jest.mock('./useAnalytics', () => ({
  ANALYTICS_DAYS: 30,
  useAnalyticsSeries: () => ({ data: null, isLoading: false, error: null }),
  useFunnel: jest.fn(),
  formatRate: (n) => (n === null || n === undefined ? '–' : `${n}%`),
}));

import { createRoot } from '@wordpress/element';
import { act } from 'react';
import FunnelPanel, { FunnelBody, funnelFormOptions } from './FunnelPanel';
import PerformanceCell from './PerformanceCell';
import { useFunnel } from './useAnalytics';
import {
  completionRate,
  dropHint,
  funnelSentence,
  funnelStages,
  stepName,
} from './funnelModel';

global.IS_REACT_ACT_ENVIRONMENT = true;

const REPORT = {
  tracking: true,
  form_tracked: true,
  seen: 100,
  started: 60,
  submitted: 38,
  left: 22,
  fields: [
    { key: 'phone', label: 'Phone', type: 'phone', count: 15, known: true },
    { key: 'message', label: 'Message', type: 'textarea', count: 5, known: true },
    { key: '', label: '', type: '', count: 2, known: false },
  ],
  steps: [{ index: 1, label: 'Contact details', count: 22 }],
};

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

describe('funnel model', () => {
  it('builds the stages with shares of seen', () => {
    const stages = funnelStages(REPORT);
    expect(stages.map((s) => [s.id, s.count, s.share, s.width])).toEqual([
      ['seen', 100, 100, 100],
      ['started', 60, 60, 60],
      ['submitted', 38, 38, 38],
    ]);
    expect(completionRate(REPORT)).toBe(63);
  });

  it('copes with no views and more starts than views', () => {
    const stages = funnelStages({ seen: 0, started: 4, submitted: 1 });
    expect(stages[1].share).toBeNull();
    expect(stages[1].width).toBe(100);
    expect(completionRate({ started: 0, submitted: 0 })).toBeNull();
  });

  it('sums the funnel up in one sentence', () => {
    expect(funnelSentence({ ...REPORT, fields: [{ key: 'phone', label: 'Phone', count: 22 }] })).toBe(
      '100 saw, 60 started, 22 stopped at Phone, 38 submitted.'
    );
    expect(funnelSentence({ seen: 3, started: 0, submitted: 0, fields: [] })).toBe('3 saw, 0 started, 0 submitted.');
  });

  it('gives plain hints', () => {
    expect(dropHint({ key: 'phone', label: 'Phone', type: 'phone', count: 22, known: true })).toBe(
      '22 people left at Phone. Consider making it optional, or say why you ask for it.'
    );
    expect(dropHint({ key: 'cv', label: 'CV', type: 'file_upload', count: 1, known: true })).toBe(
      '1 person left at CV. This takes effort. Consider making it optional.'
    );
    expect(dropHint({ key: 'old', label: 'old', count: 3, known: false })).toContain('no longer on the form');
    expect(dropHint({ key: '', count: 2 })).toContain('without touching a field');
    expect(stepName({ index: 0, label: '' })).toBe('Step 1');
    expect(stepName({ index: 1, label: 'Contact details' })).toBe('Step 2: Contact details');
  });

  it('offers every form and no "All forms" entry', () => {
    expect(funnelFormOptions([{ id: 3, title: 'Contact' }])).toEqual([{ label: 'Contact', value: '3' }]);
  });
});

describe('FunnelBody', () => {
  it('shows the stages, the drop-offs sorted as given, the hints and the steps', () => {
    const { container, unmount } = render(<FunnelBody report={REPORT} days={30} />);
    const text = container.textContent;
    expect(text).toContain('100 saw, 60 started, 15 stopped at Phone, 38 submitted.');
    expect(text).toContain('60% of seen');
    expect(text).toContain('Completion rate: 63% of the people who started sent the form.');
    const names = [...container.querySelectorAll('.sf-funnel__drop-name')].map((n) => n.textContent);
    expect(names).toEqual(['Phone', 'Message', 'Before reaching a field']);
    expect(text).toContain('15 people left at Phone.');
    expect(text).toContain('Step 2: Contact details');
    // Bars are decoration; the numbers are in the text.
    container.querySelectorAll('.sf-funnel__track').forEach((bar) => {
      expect(bar.getAttribute('aria-hidden')).toBe('true');
    });
    unmount();
  });

  it('explains an empty period', () => {
    const { container, unmount } = render(<FunnelBody report={{ tracking: true, seen: 0, started: 0, submitted: 0 }} days={7} />);
    expect(container.textContent).toContain('Nobody has seen this form in the last 7 days.');
    unmount();
  });

  it('says when tracking is off and links to the switch', () => {
    const { container, unmount } = render(<FunnelBody report={{ ...REPORT, tracking: false }} days={30} />);
    const link = container.querySelector('.sf-funnel__notice a');
    expect(link.getAttribute('href')).toBe('admin.php?page=subtleforms-settings#tab=extensions&ext=analytics');
    expect(container.querySelector('.sf-funnel__notice').textContent).toContain('Form statistics are off');
    unmount();
  });
});

describe('FunnelPanel', () => {
  beforeEach(() => {
    useFunnel.mockReset();
    useFunnel.mockReturnValue({ data: REPORT, isLoading: false, error: null });
  });

  it('starts on the first form and switches the date range with pressed buttons', () => {
    const { container, unmount } = render(<FunnelPanel forms={[{ id: 4, title: 'Quote' }, { id: 9, title: 'Contact' }]} />);
    expect(useFunnel).toHaveBeenLastCalledWith(4, 30);

    const buttons = [...container.querySelectorAll('.sf-funnel__range button')];
    expect(buttons.map((b) => b.textContent)).toEqual(['7 days', '30 days', '90 days']);
    expect(buttons[1].getAttribute('aria-pressed')).toBe('true');
    expect(container.querySelector('.sf-funnel__range').getAttribute('role')).toBe('group');

    act(() => buttons[2].click());
    expect(useFunnel).toHaveBeenLastCalledWith(4, 90);
    expect(container.querySelectorAll('.sf-funnel__range button')[2].getAttribute('aria-pressed')).toBe('true');
    unmount();
  });

  it('asks for a form when there is none', () => {
    const { container, unmount } = render(<FunnelPanel forms={[]} />);
    expect(container.textContent).toContain('Create and publish a form to see its funnel here.');
    unmount();
  });
});

describe('PerformanceCell completion rate', () => {
  it('shows the completion rate when the funnel has numbers', () => {
    const { container, unmount } = render(
      <PerformanceCell stats={{ views: 10, submissions: 3, conversion: 30, completion: 75 }} loading={false} />
    );
    expect(container.textContent).toContain('Completion rate 75%');
    unmount();
  });

  it('leaves it out without funnel numbers', () => {
    const { container, unmount } = render(
      <PerformanceCell stats={{ views: 10, submissions: 3, conversion: 30, completion: null }} loading={false} />
    );
    expect(container.textContent).not.toContain('Completion');
    unmount();
  });
});
