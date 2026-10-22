/**
 * PRO-30: the status dot follows the settings being edited.
 * PRO-08: an integration the plan does not include says which plan has it.
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';

jest.mock('./extensions/WebhooksPanel', () => () => null);
jest.mock('./extensions/EmailMarketingPanel', () => () => null);
jest.mock('./extensions/CrmPanel', () => () => null);
jest.mock('./extensions/EcommercePanel', () => () => null);
jest.mock('./extensions/PdfPanel', () => () => null);
jest.mock('./extensions/MultilanguagePanel', () => () => null);
jest.mock('./extensions/PaymentsPanel', () => () => null);
import ExtensionsSettings, { extensionStatus } from './ExtensionsSettings';

global.IS_REACT_ACT_ENVIRONMENT = true;

describe('extensionStatus (PRO-30)', () => {
  const loaded = { available: true, enabled: false, configured: false };

  test('turning email marketing on with a key makes it active without a reload', () => {
    expect(extensionStatus('email_marketing', loaded, { ext_email_marketing_enabled: true, ext_email_marketing_api_key: '********6789' })).toEqual({ enabled: true, configured: true });
    expect(extensionStatus('email_marketing', loaded, { ext_email_marketing_enabled: true, ext_email_marketing_api_key: '' })).toEqual({ enabled: true, configured: false });
    expect(extensionStatus('email_marketing', loaded, { ext_email_marketing_enabled: false })).toEqual({ enabled: false, configured: false });
  });

  test('the CRM checks the field its provider needs', () => {
    const s = { ext_crm_enabled: true, ext_crm_provider: 'webhook', ext_crm_webhook_url: 'https://h.example', ext_crm_api_key: '' };
    expect(extensionStatus('crm', loaded, s).configured).toBe(true);
    expect(extensionStatus('crm', loaded, { ...s, ext_crm_provider: 'hubspot' }).configured).toBe(false);
  });

  test('an unavailable integration never shows as enabled', () => {
    expect(extensionStatus('crm', { available: false }, { ext_crm_enabled: true }).enabled).toBe(false);
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
