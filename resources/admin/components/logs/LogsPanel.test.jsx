/**
 * Settings > Logs: Activity, Webhooks and API as sections of a section panel,
 * each with the standard header (a title and one line) above its table, and a
 * slot for sections add-ons bring.
 */
import { act } from 'react';
import { createRoot } from '@wordpress/element';
import LogsPanel, { logSectionIds } from './LogsPanel';
import '../../../shared/extend';

jest.mock('./logs.scss', () => ({}));
jest.mock('../sectionPanel/sectionPanel.scss', () => ({}));
jest.mock('../../utils/api', () => ({ apiGet: jest.fn() }));

import { apiGet } from '../../utils/api';

global.IS_REACT_ACT_ENVIRONMENT = true;
window.matchMedia =
  window.matchMedia ||
  (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));

let container;
let root;

async function mount() {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(<LogsPanel />));
}

const click = (label) =>
  act(async () => {
    [...container.querySelectorAll('.sf-section-panel__item')].find((b) => b.textContent.startsWith(label)).click();
  });

beforeEach(() => {
  apiGet.mockReset();
  apiGet.mockImplementation((path) => {
    if (path.startsWith('/forms')) return Promise.resolve({ ok: true, body: { data: [{ id: 3, title: 'Contact' }] } });
    if (path.startsWith('/tools/api-logs')) {
      return Promise.resolve({ ok: true, body: { data: { total: 1, rows: [{ id: 1, created_at: '2026-11-01 10:00', method: 'GET', route: '/forms', status: 200, user_id: 1, duration_ms: 12 }] } } });
    }
    return Promise.resolve({
      ok: true,
      body: { data: { total: 1, rows: [{ id: 9, created_at: '2026-11-01 10:00', level: 'info', form_id: 3, form_title: 'Contact', message: 'Row message' }] } },
    });
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  window.location.hash = '';
  delete window.__subtleformsExtend.slots['settings.logs'];
});

const labels = () => [...container.querySelectorAll('.sf-section-panel__item-label')].map((el) => el.textContent);

describe('Logs', () => {
  test('has the three sections, Activity first', async () => {
    await mount();
    expect(labels()).toEqual(['Activity', 'Webhooks', 'API']);
    expect(container.querySelector('.sf-section-panel__item--active').textContent).toContain('Activity');
  });

  test('every section has a title and exactly one description, and no icon', async () => {
    await mount();
    for (const name of ['Activity', 'Webhooks', 'API']) {
      await click(name);
      const header = container.querySelector('.sf-section-header');
      expect(header.querySelector('h2').textContent).toBe(name);
      expect(header.querySelectorAll('p')).toHaveLength(1);
      expect(header.querySelector('p').textContent.length).toBeGreaterThan(10);
      expect(header.querySelector('.sf-section-header__text svg')).toBeNull();
    }
  });

  test('Activity and Webhooks ask the log route with their kind, API asks its own route', async () => {
    await mount();
    expect(apiGet.mock.calls.some(([p]) => p.startsWith('/tools/logs?kind=activity'))).toBe(true);
    expect(container.textContent).toContain('Row message');
    await click('Webhooks');
    expect(apiGet.mock.calls.some(([p]) => p.startsWith('/tools/logs?kind=webhook'))).toBe(true);
    await click('API');
    expect(apiGet.mock.calls.some(([p]) => p.startsWith('/tools/api-logs'))).toBe(true);
    expect(container.textContent).toContain('/forms');
  });

  test('the level and form filters sit in the header of Activity and Webhooks only', async () => {
    await mount();
    expect(container.querySelectorAll('.sf-section-header .sf-logs__filters select')).toHaveLength(2);
    await click('API');
    expect(container.querySelector('.sf-logs__filters')).toBeNull();
  });

  test('the section is kept in the address', async () => {
    window.location.hash = '#tab=logs';
    await mount();
    await click('Webhooks');
    expect(window.location.hash).toBe('#tab=logs&section=webhooks');
  });

  test('a section an add-on registers in the settings.logs slot is added after the built-in ones', async () => {
    window.SubtleFormsExtend.registerSlotItem('settings.logs', 'integrations', {
      component: () => <p className='addon-log'>Delivery log</p>,
      label: 'Integrations',
      title: 'Integration deliveries',
      description: 'What was sent to your CRM and email services.',
      order: 10,
    });
    expect(logSectionIds()).toEqual(['activity', 'webhooks', 'api', 'integrations']);
    await mount();
    expect(labels()).toEqual(['Activity', 'Webhooks', 'API', 'Integrations']);
    await click('Integrations');
    expect(container.querySelector('.sf-section-header h2').textContent).toBe('Integration deliveries');
    expect(container.querySelector('.sf-section-header p').textContent).toBe('What was sent to your CRM and email services.');
    expect(container.querySelector('.addon-log').textContent).toBe('Delivery log');
  });

  test('an add-on cannot replace a built-in section by reusing its id', async () => {
    window.SubtleFormsExtend.registerSlotItem('settings.logs', 'api', { component: () => <p className='addon-log'>x</p>, label: 'API' });
    await mount();
    expect(labels()).toEqual(['Activity', 'Webhooks', 'API']);
    await click('API');
    expect(container.querySelector('.addon-log')).toBeNull();
  });
});
