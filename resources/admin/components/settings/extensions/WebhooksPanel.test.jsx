/**
 * The webhook test button works without SubtleForms Pro, as soon as an
 * address is typed, and uses the free route (2.4.1). Before, it needed a
 * licensed Pro and an address starting with https://.
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';
import apiFetch from '@wordpress/api-fetch';
import WebhooksPanel from './WebhooksPanel';

jest.mock('@wordpress/api-fetch', () => jest.fn());
jest.mock('./extensions.scss', () => ({}));

global.IS_REACT_ACT_ENVIRONMENT = true;
window.matchMedia =
  window.matchMedia ||
  (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));

function mount() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(<WebhooksPanel settings={{}} updateSetting={() => {}} />));
  return { container, unmount: () => act(() => root.unmount()) };
}

function type(input, value) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('WebhooksPanel test request', () => {
  beforeEach(() => {
    window.subtleformsAdmin = { hasProPlugin: false };
    apiFetch.mockReset();
  });

  test('is enabled without Pro once an address is typed, and sends it with https://', async () => {
    apiFetch.mockResolvedValue({ ok: true, message: 'Delivered. The endpoint answered HTTP 200 in 5 ms.' });
    const { container, unmount } = mount();
    const button = [...container.querySelectorAll('button')].find((b) => b.textContent.includes('Send test request'));
    const url = container.querySelector('input[type="url"]');

    expect(button.disabled).toBe(true);
    type(url, 'hooks.example.com/abc');
    expect(button.disabled).toBe(false);

    await act(async () => {
      button.click();
    });
    expect(apiFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/subtleforms/v1/webhooks/test',
        method: 'POST',
        data: expect.objectContaining({ url: 'https://hooks.example.com/abc', method: 'POST' }),
      })
    );
    expect(container.textContent).toContain('Delivered.');
    unmount();
  });

  test('shows the reason when the server refuses the address', async () => {
    apiFetch.mockRejectedValue({ code: 'blocked_url', message: 'WordPress blocks requests to localhost:9.' });
    const { container, unmount } = mount();
    const button = [...container.querySelectorAll('button')].find((b) => b.textContent.includes('Send test request'));
    type(container.querySelector('input[type="url"]'), 'http://localhost:9/x');
    await act(async () => {
      button.click();
    });
    expect(container.textContent).toContain('WordPress blocks requests to localhost:9.');
    expect(container.textContent).not.toContain('need SubtleForms Pro');
    unmount();
  });
});
