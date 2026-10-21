import { registerSettingsTab, getSettingsTab, settingsTabs } from './extend';

afterEach(() => {
  Object.keys(window.__subtleformsExtend.settingsTabs).forEach((k) => delete window.__subtleformsExtend.settingsTabs[k]);
});

describe('registerSettingsTab', () => {
  const component = () => null;

  test('keeps a tab by name and lists it', () => {
    registerSettingsTab('mcp', { component, title: 'MCP' });
    expect(getSettingsTab('mcp').component).toBe(component);
    expect(settingsTabs().map((t) => t.name)).toEqual(['mcp']);
  });

  test('is on window.SubtleFormsExtend for add-on scripts', () => {
    expect(typeof window.SubtleFormsExtend.registerSettingsTab).toBe('function');
  });

  test('ignores a bad name or a missing component', () => {
    registerSettingsTab('Bad Name', { component });
    registerSettingsTab('', { component });
    registerSettingsTab('ok', {});
    registerSettingsTab('ok2');
    expect(settingsTabs()).toEqual([]);
    expect(getSettingsTab('nothing')).toBeNull();
  });
});
