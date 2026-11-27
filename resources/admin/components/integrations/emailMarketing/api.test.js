import { announceService } from './api';

afterEach(() => {
  delete window.subtleformsAdmin;
});

test('a connected add-on service lights the Settings sidebar dot like a built-in one', () => {
  window.subtleformsAdmin = {
    extensions: { email_marketing: { builtin: true, enabled: false, configured: false } },
    emailMarketing: {
      services: {
        mailchimp: { builtin: true, enabled: false, configured: false },
        acme: { builtin: false, core: true, enabled: true, configured: false },
      },
    },
  };
  announceService('acme', { status: 'connected' });
  expect(window.subtleformsAdmin.extensions.email_marketing).toMatchObject({ enabled: true, configured: true });
});

test('a service an add-on handles itself (not core) is not counted', () => {
  window.subtleformsAdmin = {
    extensions: { email_marketing: { builtin: true, enabled: false, configured: false } },
    emailMarketing: { services: { acme: { builtin: false, enabled: true, configured: true } } },
  };
  announceService('acme', {});
  expect(window.subtleformsAdmin.extensions.email_marketing.enabled).toBe(false);
});
