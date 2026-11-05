/**
 * Settings > Integrations: the status dot follows the settings being edited,
 * and only integrations that are available and have a panel are listed.
 * Nothing is shown as locked or as needing a plan.
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';

jest.mock('./extensions/WebhooksPanel', () => () => null);
jest.mock('../integrations/emailMarketing/EmailMarketingSettings', () => {
  const BuiltIn = () => <p>Built-in Email marketing panel</p>;
  return BuiltIn;
});
import ExtensionsSettings, { extensionStatus, listedExtensions } from './ExtensionsSettings';

global.IS_REACT_ACT_ENVIRONMENT = true;

describe('extensionStatus', () => {
  test('webhooks are always configured', () => {
    expect(extensionStatus('webhooks', { enabled: true })).toEqual({ enabled: true, configured: true });
  });

  test('an unavailable integration never shows as enabled', () => {
    expect(extensionStatus('crm', { available: false, enabled: true })).toEqual({ enabled: false, configured: false });
  });
});

describe('listed integrations', () => {
  test('only Webhooks and integrations with a registered panel are listed', () => {
    const list = listedExtensions({
      webhooks: { available: true },
      email_marketing: { available: true },
      crm: { available: true },
      multilanguage: { available: false, requires: 'Agency' },
    });
    expect(list).toEqual(['webhooks']);
  });
});

describe('no locked integrations', () => {
  let container;
  let root;
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    delete window.subtleformsAdmin;
  });

  test('an integration that is not available is not listed and no plan is named', async () => {
    window.subtleformsAdmin = {
      extensions: {
        webhooks: { slug: 'webhooks', label: 'Webhooks', available: true, enabled: true, configured: true },
        multilanguage: { slug: 'multilanguage', label: 'Multilanguage', description: 'Translate forms.', available: false, enabled: false, configured: true, requires: 'Agency' },
      },
    };
    window.location.hash = '#ext=multilanguage';
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(<ExtensionsSettings settings={{}} updateSetting={() => {}} />));

    expect(container.textContent).toContain('Webhooks');
    expect(container.textContent).not.toContain('Multilanguage');
    expect(container.textContent).not.toMatch(/Needs|plan|Pro\b|licen/i);
  });
});

describe('Email marketing', () => {
  let container;
  let root;
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    delete window.subtleformsAdmin;
    delete window.__subtleformsExtend.slots['settings.extensions'];
  });

  async function mount(extensions) {
    window.subtleformsAdmin = { extensions };
    window.location.hash = '#ext=email_marketing';
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(<ExtensionsSettings settings={{}} updateSetting={() => {}} />));
  }

  const WEBHOOKS = { slug: 'webhooks', label: 'Webhooks', available: true, enabled: true, configured: true };
  const EM = { slug: 'email_marketing', label: 'Email marketing', available: true, enabled: false, configured: false, builtin: true };

  test('the built-in entry is listed second, after Webhooks, and draws the built-in panel; there is no Mailchimp entry', async () => {
    expect(listedExtensions({ email_marketing: EM, webhooks: WEBHOOKS })).toEqual(['webhooks', 'email_marketing']);
    await mount({ webhooks: WEBHOOKS, email_marketing: EM });
    expect(container.textContent).toContain('Email marketing');
    expect(container.textContent).toContain('Built-in Email marketing panel');
    expect(container.textContent).not.toContain('Mailchimp');
  });

  test('the status dot follows the services', async () => {
    expect(extensionStatus('email_marketing', { enabled: false, configured: false, builtin: true })).toEqual({ enabled: false, configured: false });
    expect(extensionStatus('email_marketing', { enabled: true, configured: false, builtin: true })).toEqual({ enabled: true, configured: false });
    expect(extensionStatus('email_marketing', { enabled: true, configured: true, builtin: true })).toEqual({ enabled: true, configured: true });
  });

  test('an add-on entry without the builtin flag is drawn from the slot, not by the built-in panel', async () => {
    window.SubtleFormsExtend.registerSlotItem('settings.extensions', 'email_marketing', { component: () => <p>Add-on Email marketing panel</p> });
    await mount({ webhooks: WEBHOOKS, email_marketing: { ...EM, builtin: undefined } });
    expect(container.textContent).toContain('Add-on Email marketing panel');
    expect(container.textContent).not.toContain('Built-in Email marketing panel');
  });

  test('an add-on entry with no panel is not listed at all', () => {
    expect(listedExtensions({ webhooks: WEBHOOKS, email_marketing: { label: 'Email marketing', available: true } })).toEqual(['webhooks']);
  });

  test('choosing another integration drops the service from the address', async () => {
    await mount({ webhooks: WEBHOOKS, email_marketing: EM });
    window.location.hash = '#tab=extensions&ext=email_marketing&service=brevo';
    const webhooks = [...container.querySelectorAll('button')].find((b) => b.textContent.includes('Webhooks'));
    await act(async () => webhooks.click());
    expect(window.location.hash).toContain('ext=webhooks');
    expect(window.location.hash).not.toContain('service=');
  });
});
