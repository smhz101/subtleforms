/**
 * #142: the builder preview says when a CAPTCHA has no keys on the field and
 * none in Settings, and counts the keys in Settings as ready.
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';
import FieldRenderer from './FieldRenderer';
import { unconfiguredCaptchaFields } from '../../../shared/captchaReady';

jest.mock('./FieldRenderer.scss', () => ({}));

global.IS_REACT_ACT_ENVIRONMENT = true;

const WARNING = 'No keys yet, so this check is skipped on the live form.';
const READY = 'CAPTCHA will appear here on the live form';

function render(field) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(<FieldRenderer field={field} />));
  return { container, unmount: () => act(() => root.unmount()) };
}

afterEach(() => { delete window.subtleformsData; });

describe('CAPTCHA preview status', () => {
  test('is the warning when neither the field nor Settings has keys', () => {
    window.subtleformsData = { captchaReady: { recaptcha: false, hcaptcha: false, turnstile: false } };
    const { container, unmount } = render({ id: 'c', key: 'c', type: 'recaptcha', label: 'Captcha' });
    const status = container.querySelector('.sf-captcha-preview__status');
    expect(status.textContent).toContain(WARNING);
    expect(status.className).toContain('sf-captcha-preview__status--warning');
    const link = status.querySelector('a');
    expect(link.textContent).toBe('Add keys in Settings, Security & privacy');
    expect(link.getAttribute('href')).toBe('admin.php?page=subtleforms-settings#tab=advanced');
    expect(link.getAttribute('target')).toBeNull();
    unmount();
  });

  test('is the warning when only one key is on the field', () => {
    window.subtleformsData = { captchaReady: {} };
    const { container, unmount } = render({ id: 'c', key: 'c', type: 'hcaptcha', config: { site_key: 'a' } });
    expect(container.querySelector('.sf-captcha-preview__status').textContent).toContain(WARNING);
    unmount();
  });

  test('is the ready text when only Settings has keys', () => {
    window.subtleformsData = { captchaReady: { recaptcha: false, hcaptcha: false, turnstile: true } };
    const { container, unmount } = render({ id: 'c', key: 'c', type: 'turnstile', label: 'Captcha' });
    const status = container.querySelector('.sf-captcha-preview__status');
    expect(status.textContent).toContain(READY);
    expect(status.className).not.toContain('--warning');
    unmount();
  });

  test('is the ready text when the field has both keys', () => {
    window.subtleformsData = { captchaReady: {} };
    const { container, unmount } = render({ id: 'c', key: 'c', type: 'recaptcha', config: { site_key: 'a', secret_key: 'b' } });
    expect(container.querySelector('.sf-captcha-preview__status').textContent).toContain(READY);
    unmount();
  });
});

describe('unconfiguredCaptchaFields', () => {
  const none = { recaptcha: false, hcaptcha: false, turnstile: false };

  test('finds fields nested in steps and columns', () => {
    const fields = [
      { id: 'a', type: 'text' },
      { id: 'step', type: 'step', children: [{ id: 'b', type: 'turnstile' }] },
      { id: 'row', type: 'row', columns: [[{ id: 'c', type: 'hcaptcha' }], { fields: [{ id: 'd', type: 'recaptcha', config: { site_key: 'a', secret_key: 'b' } }] }] },
    ];
    expect(unconfiguredCaptchaFields(fields, none).map((f) => f.id)).toEqual(['b', 'c']);
  });

  test('keys in Settings make the provider ready', () => {
    const fields = [{ id: 'b', type: 'turnstile' }, { id: 'c', type: 'hcaptcha' }];
    expect(unconfiguredCaptchaFields(fields, { ...none, turnstile: true }).map((f) => f.id)).toEqual(['c']);
  });
});
