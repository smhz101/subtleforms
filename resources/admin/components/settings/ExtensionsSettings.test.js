/**
 * PRO-30: the status dot follows the settings being edited.
 * PRO-08: an integration the plan does not include says which plan has it.
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';

jest.mock('./extensions/WebhooksPanel', () => () => null);
import ExtensionsSettings, { extensionStatus, listedExtensions } from './ExtensionsSettings';

global.IS_REACT_ACT_ENVIRONMENT = true;

describe('extensionStatus (PRO-30)', () => {
  test('webhooks are always configured', () => {
    expect(extensionStatus('webhooks', { enabled: true })).toEqual({ enabled: true, configured: true });
  });

  test('an unavailable integration never shows as enabled', () => {
    expect(extensionStatus('crm', { available: false, enabled: true })).toEqual({ enabled: false, configured: false });
  });
});

describe('listed integrations', () => {
  test('the removed Free panels are gone: only Webhooks and locked cards are listed', () => {
    const list = listedExtensions({
      webhooks: { available: true },
      email_marketing: { available: true },
      crm: { available: true },
      payments: { available: true },
      pdf: { available: true },
      multilanguage: { available: false, requires: 'Agency' },
    });
    expect(list).toEqual(['webhooks', 'multilanguage']);
  });
});

describe('locked integrations (PRO-08)', () => {
  let container;
  let root;
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    delete window.subtleformsAdmin;
  });

  test('a Starter license lists Multilanguage with the plan that has it', async () => {
    window.subtleformsAdmin = {
      hasProPlugin: true,
      extensions: {
        webhooks: { slug: 'webhooks', label: 'Webhooks', available: true, enabled: true, configured: true },
        multilanguage: { slug: 'multilanguage', label: 'Multilanguage', description: 'Translate forms.', available: false, enabled: false, configured: true, requires: 'Agency' },
        crm: { slug: 'crm', label: 'CRM', available: false, requires: '' },
      },
    };
    window.location.hash = '#ext=multilanguage';
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(<ExtensionsSettings settings={{}} updateSetting={() => {}} />));

    expect(container.textContent).toContain('Needs Agency');
    expect(container.textContent).toContain('Included with the Agency plan.');
    expect(container.textContent).not.toContain('CRM');
  });
});
