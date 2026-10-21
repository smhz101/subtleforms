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
