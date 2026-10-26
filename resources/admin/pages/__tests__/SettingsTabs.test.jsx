/**
 * Settings has no Branding tab and a stale tab=branding link lands on the
 * first tab. Settings has no License or MCP placeholder: an MCP tab is listed
 * only when an add-on registers it.
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';

jest.mock('../SettingsPage.scss', () => ({}));
jest.mock('../../components/AdminShell', () => ({ children }) => <div>{children}</div>);
jest.mock('../../components/settings/GeneralSettings', () => () => null);
jest.mock('../../components/settings/FrontendSettings', () => () => null);
jest.mock('../../components/settings/EmailSettings', () => () => null);
jest.mock('../../components/settings/AdvancedSettings', () => () => null);
jest.mock('../../components/settings/ExtensionsSettings', () => () => null);
jest.mock('../../hooks/useSettingsState', () => ({
  __esModule: true,
  default: jest.fn(),
}));

import useSettingsState from '../../hooks/useSettingsState';
import '../../../shared/extend';
import Settings, { ALL_TABS, getGroups, resolveTab } from '../SettingsPage';

global.IS_REACT_ACT_ENVIRONMENT = true;

const state = (activeTab) => ({
  settings: {},
  loading: false,
  saving: false,
  message: null,
  setMessage: () => {},
  fieldErrors: {},
  hasChanges: false,
  activeTab,
  setActiveTab: () => {},
  updateSetting: () => {},
  saveSettings: () => {},
  loadSettings: () => {},
  resetSettings: () => {},
});

function render(activeTab) {
  useSettingsState.mockReturnValue(state(activeTab));
  const container = document.createElement('div');
  const root = createRoot(container);
  act(() => root.render(<Settings />));
  return { container, unmount: () => act(() => root.unmount()) };
}

test('Settings has no branding tab', () => {
  expect(ALL_TABS.map((t) => t.name)).not.toContain('branding');
  const { container, unmount } = render('general');
  expect(container.textContent).not.toMatch(/Branding/);
  unmount();
});

test('a stale tab=branding falls back to the first tab', () => {
  expect(resolveTab('branding').name).toBe(ALL_TABS[0].name);
  const { container, unmount } = render('branding');
  expect(container.querySelector('.sf-settings__nav-item.is-active').textContent).toContain(ALL_TABS[0].title);
  expect(container.querySelector('.sf-settings__title').textContent).toBe(ALL_TABS[0].title);
  unmount();
});

// FF-02, WP2-08: the AI assistant tab was a screen that faked a connection
// test. It is gone, and so are its words.
test('Settings has no AI assistant tab and no connection test', () => {
  expect(ALL_TABS.map((t) => t.name)).not.toContain('ai');
  const { container, unmount } = render('general');
  expect(container.textContent).not.toMatch(/AI assistant|Test Connection|API key/i);
  unmount();
});

test('a stale tab=ai falls back to the first tab', () => {
  expect(resolveTab('ai').name).toBe(ALL_TABS[0].name);
  const { container, unmount } = render('ai');
  expect(container.querySelector('.sf-settings__title').textContent).toBe(ALL_TABS[0].title);
  unmount();
});

// Tools moved into Settings. MCP is listed only when an add-on registers it.
describe('Tools and MCP tabs', () => {
  const names = () => ALL_TABS.map((t) => t.name);

  afterEach(() => {
    delete window.__subtleformsExtend.settingsTabs.mcp;
  });

  test('Settings lists a Tools tab and no License or MCP tab of its own', () => {
    expect(names()).toContain('tools');
    expect(names()).not.toContain('mcp');
    expect(names()).not.toContain('license');
    const { container, unmount } = render('general');
    const items = [...container.querySelectorAll('.sf-settings__nav-item')].map((el) => el.textContent);
    expect(items.some((t) => t.startsWith('Tools'))).toBe(true);
    expect(items.some((t) => t.startsWith('MCP'))).toBe(false);
    expect(container.textContent).not.toMatch(/License|Licence|Upgrade|\bPro\b/);
    unmount();
  });

  test('a stale tab=license or tab=mcp falls back to the first tab', () => {
    expect(resolveTab('license').name).toBe(ALL_TABS[0].name);
    expect(resolveTab('mcp').name).toBe(ALL_TABS[0].name);
  });

  test('every tab is a button, so the list is reachable by keyboard', () => {
    const { container, unmount } = render('general');
    const items = container.querySelectorAll('.sf-settings__nav-item');
    expect(items.length).toBeGreaterThan(5);
    items.forEach((el) => expect(el.tagName).toBe('BUTTON'));
    unmount();
  });

  test('a tab an add-on registers needs its own title; this plugin names none (P1-03)', () => {
    window.SubtleFormsExtend.registerSettingsTab('mcp', { component: () => <p className='addon-mcp'>MCP screen</p> });
    expect(getGroups().flatMap((g) => g.tabs.map((t) => t.name))).not.toContain('mcp');
    window.SubtleFormsExtend.registerSettingsTab('mcp', { title: 'Add-on tab', description: 'From the add-on.', group: 'site', component: () => <p className='addon-mcp'>MCP screen</p> });
    const { container, unmount } = render('mcp');
    expect(container.querySelector('.sf-settings__title').textContent).toBe('Add-on tab');
    expect(container.querySelector('.addon-mcp').textContent).toBe('MCP screen');
    expect(container.querySelector('.sf-savebar')).toBeNull();
    unmount();
  });

  test('an add-on can add a tab of its own and it saves itself', () => {
    window.SubtleFormsExtend.registerSettingsTab('reports-mail', {
      title: 'Report email',
      description: 'Weekly summary.',
      component: () => <p className='addon-body'>Body</p>,
    });
    const { container, unmount } = render('reports-mail');
    expect([...container.querySelectorAll('.sf-settings__nav-item')].map((el) => el.textContent.trim())).toContain('Report email');
    expect(container.querySelector('.addon-body').textContent).toBe('Body');
    expect(container.querySelector('.sf-savebar')).toBeNull();
    unmount();
    delete window.__subtleformsExtend.settingsTabs['reports-mail'];
  });
});

// A tab registered with group 'site' sits after Tools, whatever order it asks for.
describe('A site tab sits right after Tools', () => {
  const navNames = (container) =>
    [...container.querySelectorAll('.sf-settings__nav-item span')].map((el) => el.textContent);
  const order = () => getGroups().flatMap((g) => g.tabs.map((t) => t.name));

  afterEach(() => {
    delete window.__subtleformsExtend.settingsTabs.mcp;
    delete window.__subtleformsExtend.settingsTabs['reports-mail'];
  });

  test('without an add-on there is no MCP tab and no Add-ons group', () => {
    expect(order()).not.toContain('mcp');
    expect(getGroups().map((g) => g.key)).toEqual(['site']);
  });

  test("the add-on's site tab lands right after Tools, even with its own order", () => {
    window.SubtleFormsExtend.registerSettingsTab('mcp', {
      title: 'MCP server',
      group: 'site',
      order: 1,
      component: () => <p className='addon-mcp'>MCP screen</p>,
    });
    window.SubtleFormsExtend.registerSettingsTab('reports-mail', {
      title: 'Report email',
      component: () => <p>Body</p>,
    });
    const after = order();
    expect(after[after.indexOf('tools') + 1]).toBe('mcp');
    expect(after.filter((n) => n === 'mcp')).toHaveLength(1);
    const site = getGroups().find((g) => g.key === 'site').tabs.map((t) => t.name);
    expect(site[site.length - 1]).toBe('mcp');

    const { container, unmount } = render('mcp');
    const labels = navNames(container);
    expect(labels[labels.indexOf('Tools') + 1]).toBe('MCP server');
    expect(container.querySelector('.addon-mcp')).not.toBeNull();
    unmount();
  });
});
