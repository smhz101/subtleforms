/**
 * The Cloudflare notice on Security & privacy: shown when the server says this
 * page came through Cloudflare and the setting is off, dismissible, and the
 * dismissal is stored for the user.
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';

jest.mock('../../data/apiClient', () => ({
  apiClient: { post: jest.fn(() => Promise.resolve({})) },
}));

import { apiClient } from '../../data/apiClient';
import AdvancedSettings, { CloudflareNotice } from './AdvancedSettings';

global.IS_REACT_ACT_ENVIRONMENT = true;

function mount(element) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(element));
  return { container, unmount: () => { act(() => root.unmount()); container.remove(); } };
}

afterEach(() => {
  apiClient.post.mockClear();
  delete window.subtleformsAdmin;
});

test('shows the notice and points at the setting', () => {
  window.subtleformsAdmin = { cloudflareNotice: true };
  const { container, unmount } = mount(<CloudflareNotice settings={{ trust_cloudflare: false }} />);
  const notice = container.querySelector('.sf-cloudflare-notice');
  expect(notice).not.toBeNull();
  expect(notice.textContent).toContain('behind Cloudflare');
  expect(notice.textContent).toContain('Site is behind Cloudflare');
  expect(notice.textContent).not.toContain('—');
  unmount();
});

test('shows nothing when the server did not detect Cloudflare', () => {
  window.subtleformsAdmin = { cloudflareNotice: false };
  const { container, unmount } = mount(<CloudflareNotice settings={{ trust_cloudflare: false }} />);
  expect(container.querySelector('.sf-cloudflare-notice')).toBeNull();
  unmount();
});

test('shows nothing once the setting is on', () => {
  window.subtleformsAdmin = { cloudflareNotice: true };
  const { container, unmount } = mount(<CloudflareNotice settings={{ trust_cloudflare: true }} />);
  expect(container.querySelector('.sf-cloudflare-notice')).toBeNull();
  unmount();
});

test('dismissing hides it and stores the choice', () => {
  window.subtleformsAdmin = { cloudflareNotice: true };
  const { container, unmount } = mount(<CloudflareNotice settings={{ trust_cloudflare: false }} />);
  const close = container.querySelector('.components-notice__dismiss');
  expect(close).not.toBeNull();
  act(() => close.click());
  expect(container.querySelector('.sf-cloudflare-notice')).toBeNull();
  expect(apiClient.post).toHaveBeenCalledWith('/cloudflare-notice/dismiss', {});
  unmount();
});

test('the settings screen shows it next to the Cloudflare setting', () => {
  window.subtleformsAdmin = { cloudflareNotice: true };
  const { container, unmount } = mount(
    <AdvancedSettings settings={{ trust_cloudflare: false, trusted_proxy_cidrs: [] }} updateSetting={() => {}} resetSettings={() => {}} saving={false} />
  );
  expect(container.querySelector('.sf-cloudflare-notice')).not.toBeNull();
  expect(container.querySelector('#sf-trust-cloudflare input')).not.toBeNull();
  unmount();
});
