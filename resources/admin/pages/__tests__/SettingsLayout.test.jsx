/**
 * Every Settings screen sits in the same content column, the width of the
 * Integrations section panel, and Logs is its own entry between Integrations
 * and Tools (the logs left Tools).
 */
import fs from 'fs';
import path from 'path';
import { createRoot } from '@wordpress/element';
import { act } from 'react';

jest.mock('../SettingsPage.scss', () => ({}));
jest.mock('../../components/AdminShell', () => function AdminShellMock({ children }) {
  return <div>{children}</div>;
});
jest.mock('../../components/settings/GeneralSettings', () => function Mock() { return <p>general</p>; });
jest.mock('../../components/settings/FrontendSettings', () => function Mock() { return <p>display</p>; });
jest.mock('../../components/settings/EmailSettings', () => function Mock() { return <p>email</p>; });
jest.mock('../../components/settings/AdvancedSettings', () => function Mock() { return <p>advanced</p>; });
jest.mock('../../components/settings/ExtensionsSettings', () => function Mock() { return <p>integrations</p>; });
jest.mock('../../components/logs/LogsPanel', () => function Mock() { return <p>logs</p>; });
jest.mock('../ToolsPage', () => ({ __esModule: true, default: function Tools() { return <p>tools</p>; } }));
jest.mock('../../hooks/useSettingsState', () => ({ __esModule: true, default: jest.fn() }));

import useSettingsState from '../../hooks/useSettingsState';
import '../../../shared/extend';
import Settings, { ALL_TABS } from '../SettingsPage';

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

async function render(activeTab) {
  useSettingsState.mockReturnValue(state(activeTab));
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => root.render(<Settings />));
  return {
    container,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

const SCREENS = ['general', 'frontend', 'email', 'advanced', 'extensions', 'logs', 'tools'];

describe('one content width', () => {
  test.each(SCREENS)('%s is drawn in the shared content column and panel', async (name) => {
    const { container, unmount } = await render(name);
    const panel = container.querySelector('.sf-settings__content > .sf-settings__panel');
    expect(panel).not.toBeNull();
    expect(container.querySelector('.sf-settings__content').className).toBe('sf-settings__content');
    expect(panel.textContent).not.toBe('');
    unmount();
  });

  test('every screen has the same wrapper classes except its own name modifier', async () => {
    const seen = new Set();
    for (const name of SCREENS) {
      const { container, unmount } = await render(name);
      const column = container.querySelector('.sf-settings__content');
      seen.add(`${column.className}|${column.parentElement.className}`);
      unmount();
    }
    expect(seen.size).toBe(1);
  });

  test('the style sheet gives the content column one width and no screen its own', () => {
    const scss = fs.readFileSync(path.join(__dirname, '..', 'SettingsPage.scss'), 'utf8');
    expect(scss).toMatch(/&__content\s*\{[^}]*max-width:\s*var\(--sf-settings-width, 1040px\)/s);
    expect(scss).not.toMatch(/panel--extensions/);
    expect(scss).not.toMatch(/sf-settings__content:has\(/);
    expect(scss).not.toMatch(/max-width:\s*760px/);
  });
});

describe('Logs entry', () => {
  test('is listed after Integrations and before Tools', () => {
    const names = ALL_TABS.map((t) => t.name);
    expect(names.indexOf('logs')).toBe(names.indexOf('extensions') + 1);
    expect(names.indexOf('tools')).toBe(names.indexOf('logs') + 1);
  });

  test('has a title and a description and no Save button', async () => {
    const { container, unmount } = await render('logs');
    expect(container.querySelector('.sf-settings__title').textContent).toBe('Logs');
    expect(container.querySelector('.sf-settings__description').textContent.length).toBeGreaterThan(10);
    expect(container.querySelector('.sf-savebar')).toBeNull();
    unmount();
  });

  test('Tools no longer mentions the logs', () => {
    const tools = ALL_TABS.find((t) => t.name === 'tools');
    expect(tools.description).not.toMatch(/read what the site|log/i);
  });
});
