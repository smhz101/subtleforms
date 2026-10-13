jest.mock('./analytics.scss', () => ({}));
jest.mock('./useAnalytics', () => ({
  ANALYTICS_DAYS: 30,
  useAnalyticsSeries: () => ({ data: null, isLoading: false, error: null, locked: false }),
  formatRate: (n) => String(n),
  sampleSeries: () => [],
}));

import { performanceFormOptions } from './FormAnalyticsPanel';

describe('performanceFormOptions (QA-20)', () => {
  const forms = Array.from({ length: 12 }, (_, index) => ({
    id: index + 1,
    title: `Form ${index + 1}`,
  }));
  forms[11].title = 'Ancient contact form';

  it('lists every form, including ones past the first ten', () => {
    const options = performanceFormOptions(forms);
    expect(options).toHaveLength(13);
    expect(options[0]).toEqual({ label: 'All forms', value: '0' });
    expect(options.map((option) => option.value)).toContain('12');
    expect(options.map((option) => option.label)).toContain('Ancient contact form');
  });

  it('can reach an older form by title or id', () => {
    expect(performanceFormOptions(forms, 'ancient').map((option) => option.value)).toEqual(['0', '12']);
    expect(performanceFormOptions(forms, '12').map((option) => option.value)).toEqual(['0', '12']);
  });
});
