/**
 * An old Settings address is sent to the place its screen moved to: the logs
 * left Tools for Logs, and an add-on can register its own redirects.
 */
import { applySettingsRedirects, redirectedHash } from './settingsRedirects';
import { registerSettingsRedirect } from '../../shared/extend';

afterEach(() => {
  window.location.hash = '';
});

describe('redirectedHash', () => {
  test.each(['activity', 'webhooks', 'api'])('Tools > %s opens the same section of Logs', (section) => {
    expect(redirectedHash(`#tab=tools&section=${section}`)).toBe(`tab=logs&section=${section}`);
  });

  test('the rest of Tools stays in Tools', () => {
    expect(redirectedHash('#tab=tools')).toBeNull();
    expect(redirectedHash('#tab=tools&section=migrate')).toBeNull();
    expect(redirectedHash('#tab=tools&section=transfer')).toBeNull();
  });

  test('other tabs are left alone, even with a section of the same name', () => {
    expect(redirectedHash('#tab=logs&section=api')).toBeNull();
    expect(redirectedHash('#tab=extensions&ext=webhooks')).toBeNull();
    expect(redirectedHash('')).toBeNull();
  });

  test('parameters the redirect does not set are kept', () => {
    expect(redirectedHash('#tab=tools&section=api&page=2')).toBe('tab=logs&section=api&page=2');
  });

  test('an add-on redirect sets the parameters it names', () => {
    registerSettingsRedirect({ tab: 'old-addon-tab' }, { tab: 'extensions', ext: 'addon' });
    expect(redirectedHash('#tab=old-addon-tab')).toBe('tab=extensions&ext=addon');
  });
});

describe('applySettingsRedirects', () => {
  test('rewrites the address in place without adding a history entry', () => {
    window.location.hash = '#tab=tools&section=webhooks';
    const before = window.history.length;
    expect(applySettingsRedirects()).toBe(true);
    expect(window.location.hash).toBe('#tab=logs&section=webhooks');
    expect(window.history.length).toBe(before);
  });

  test('does nothing for an address that is fine', () => {
    window.location.hash = '#tab=general';
    expect(applySettingsRedirects()).toBe(false);
    expect(window.location.hash).toBe('#tab=general');
  });
});
