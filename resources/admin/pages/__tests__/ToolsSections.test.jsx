/**
 * Settings > Tools is a section panel like Integrations and Logs: Transfer and
 * Migrate on the left, each with the standard header, and a slot for sections
 * add-ons bring. The logs live in Settings > Logs.
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';
import '../../../shared/extend';

jest.mock('../ToolsPage.scss', () => ({}));
jest.mock('../../components/sectionPanel/sectionPanel.scss', () => ({}));
jest.mock('../../components/tools/SiteImport', () => function Mock() { return <p>site import</p>; });
jest.mock('../../utils/api', () => ({
  apiGet: jest.fn(() => Promise.resolve({ ok: true, body: { data: [] } })),
  apiPost: jest.fn(),
}));
jest.mock('../../data/apiClient', () => ({ apiClient: { get: jest.fn() } }));

import { apiClient } from '../../data/apiClient';
import { redirectedHash } from '../../utils/settingsRedirects';
import { registerSlotItem } from '../../../shared/extend';
import ToolsPanel, { toolSectionIds } from '../ToolsPage';
import { testClient, withClient } from '../../../../tests/js/queryWrapper';

global.IS_REACT_ACT_ENVIRONMENT = true;
window.matchMedia =
  window.matchMedia ||
  (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));

let container;
let root;

async function mount(client = testClient()) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(withClient(<ToolsPanel />, client)));
}

async function unmount() {
  await act(async () => root.unmount());
  container.remove();
}

const labels = () => [...container.querySelectorAll('.sf-section-panel__item-label')].map((el) => el.textContent);
const active = () => container.querySelector('.sf-section-panel__item--active').textContent;
const click = (label) =>
  act(async () => {
    [...container.querySelectorAll('.sf-section-panel__item')].find((b) => b.textContent.startsWith(label)).click();
  });

beforeEach(() => {
  apiClient.get.mockReset();
  apiClient.get.mockResolvedValue([{ id: 4, title: 'Contact' }]);
});

afterEach(async () => {
  await unmount();
  window.location.hash = '';
  delete window.__subtleformsExtend.slots['settings.tools'];
});

test('Tools lists Transfer and Migrate, and no log', async () => {
  await mount();
  expect(labels()).toEqual(['Transfer', 'Migrate']);
  expect(container.textContent).not.toMatch(/What happened after each entry|Calls this site made|REST calls/);
  expect(container.querySelector('.sf-tools__nav')).toBeNull();
});

test('every section has a standard header: a title and one description, no icon', async () => {
  await mount();
  for (const name of ['Transfer', 'Migrate']) {
    await click(name);
    const headers = container.querySelectorAll('.sf-section-header');
    expect(headers).toHaveLength(1);
    expect(headers[0].querySelector('.sf-section-header__title').textContent).toBe(name);
    expect(headers[0].querySelectorAll('.sf-section-header__description')).toHaveLength(1);
    expect(headers[0].querySelector('svg')).toBeNull();
  }
});

test('Transfer is the first section and shows the forms and submissions cards', async () => {
  await mount();
  expect(active()).toBe('Transfer');
  expect(container.textContent).toContain('Export forms');
  expect(container.textContent).toContain('Export submissions');
  expect(container.textContent).toContain('Contact');
});

test('the address keeps the section, and a link opens it', async () => {
  window.location.hash = '#tab=tools&section=migrate';
  await mount();
  expect(active()).toBe('Migrate');
  expect(container.textContent).toContain('site import');
  await click('Transfer');
  expect(window.location.hash).toBe('#tab=tools&section=transfer');
});

test('an unknown section, or a log section that moved to Logs, opens Transfer', async () => {
  window.location.hash = '#tab=tools&section=activity';
  await mount();
  expect(active()).toBe('Transfer');
});

test('the old Tools log addresses are forwarded to Logs', () => {
  expect(redirectedHash('#tab=tools&section=activity')).toBe('tab=logs&section=activity');
  expect(redirectedHash('tab=tools&section=webhooks')).toBe('tab=logs&section=webhooks');
  expect(redirectedHash('#tab=tools&section=api')).toBe('tab=logs&section=api');
  // Transfer and Migrate keep their ids, so their addresses need no redirect.
  expect(redirectedHash('#tab=tools&section=transfer')).toBeNull();
  expect(redirectedHash('#tab=tools&section=migrate')).toBeNull();
});

test('an add-on section from the settings.tools slot is listed after Migrate with its header', async () => {
  function Body() {
    return <p>add-on body</p>;
  }
  registerSlotItem('settings.tools', 'cleanup', { component: Body, label: 'Cleanup', title: 'Clean up', description: 'Remove old data.', order: 10 });
  await mount();
  expect(labels()).toEqual(['Transfer', 'Migrate', 'Cleanup']);
  expect(toolSectionIds()).toEqual(['transfer', 'migrate', 'cleanup']);
  await click('Cleanup');
  expect(container.querySelector('.sf-section-header__title').textContent).toBe('Clean up');
  expect(container.querySelector('.sf-section-header__description').textContent).toBe('Remove old data.');
  expect(container.textContent).toContain('add-on body');
});

test('the form list comes from the cache when Tools is opened again, and no new request is made', async () => {
  const client = testClient({ queries: { staleTime: 60 * 1000 } });
  await mount(client);
  expect(apiClient.get).toHaveBeenCalledTimes(1);
  expect(apiClient.get.mock.calls[0][0]).toMatch(/^\/forms\?per_page=100/);
  await unmount();

  await mount(client);
  // The second mount paints the forms from the cache at once.
  expect(container.textContent).toContain('Contact');
  expect(apiClient.get).toHaveBeenCalledTimes(1);
});

test('creating or changing a form drops the cached list', async () => {
  const client = testClient({ queries: { staleTime: 60 * 1000 } });
  await mount(client);
  expect(apiClient.get).toHaveBeenCalledTimes(1);
  // What the forms mutations do after a create, update or delete.
  await act(async () => {
    await client.invalidateQueries({ queryKey: ['forms', 'list'] });
  });
  expect(apiClient.get).toHaveBeenCalledTimes(2);
});
