/**
 * Branding is set in the licence portal now, so Settings has no Branding tab
 * and a stale tab=branding link lands on the first tab.
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';

jest.mock('../SettingsPage.scss', () => ({}));
jest.mock('../../components/AdminShell', () => ({ children }) => <div>{children}</div>);
jest.mock('../../components/settings/GeneralSettings', () => () => null);
jest.mock('../../components/settings/FrontendSettings', () => () => null);
jest.mock('../../components/settings/EmailSettings', () => () => null);
jest.mock('../../components/settings/AdvancedSettings', () => () => null);
jest.mock('../../components/settings/LicenseSettings', () => () => null);
jest.mock('../../components/settings/ExtensionsSettings', () => () => null);
jest.mock('../../hooks/useSettingsState', () => ({
  __esModule: true,
  default: jest.fn(),
}));

import useSettingsState from '../../hooks/useSettingsState';
import '../../../shared/extend';
import Settings, { ALL_TABS, resolveTab } from '../SettingsPage';

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

// Tools moved into Settings, and MCP has its slot for Pro.
describe('Tools and MCP tabs', () => {
  const names = () => ALL_TABS.map((t) => t.name);

  test('Settings lists a Tools tab and an MCP tab', () => {
    expect(names()).toEqual(expect.arrayContaining(['tools', 'mcp']));
    const { container, unmount } = render('general');
    const items = [...container.querySelectorAll('.sf-settings__nav-item')].map((el) => el.textContent);
    expect(items.some((t) => t.startsWith('Tools'))).toBe(true);
    expect(items.some((t) => t.startsWith('MCP'))).toBe(true);
    unmount();
  });

  test('every tab is a button, so the list is reachable by keyboard', () => {
    const { container, unmount } = render('general');
    const items = container.querySelectorAll('.sf-settings__nav-item');
    expect(items.length).toBeGreaterThan(6);
    items.forEach((el) => expect(el.tagName).toBe('BUTTON'));
    unmount();
  });

  test('MCP without Pro explains itself and links to the upgrade page', () => {
    const { container, unmount } = render('mcp');
    expect(container.querySelector('.sf-settings__title').textContent).toBe('MCP');
    const note = container.querySelector('.sf-mcp-placeholder');
    expect(note).not.toBeNull();
    expect(note.textContent).toMatch(/part of SubtleForms Pro/);
    const link = note.querySelector('a');
    expect(link.getAttribute('href')).toMatch(/^https:\/\/subtleforms\.com\/pro\?utm_source=plugin&utm_medium=upgrade&utm_campaign=mcp$/);
    expect(link.getAttribute('rel')).toContain('noopener');
    unmount();
  });

  test('a component Pro registers under "mcp" replaces the note', () => {
    window.SubtleFormsExtend.registerSettingsTab('mcp', { component: () => <p className='pro-mcp'>Pro MCP screen</p> });
    const { container, unmount } = render('mcp');
    expect(container.querySelector('.pro-mcp').textContent).toBe('Pro MCP screen');
    expect(container.querySelector('.sf-mcp-placeholder')).toBeNull();
    unmount();
    delete window.__subtleformsExtend.settingsTabs.mcp;
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
