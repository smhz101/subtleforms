/**
 * The More features card on the Dashboard: the one place that says what the
 * separate plugin adds. It shows only when the server says so, links once
 * to the product page and can be dismissed; dismissing it is stored for the
 * user and it does not come back.
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';

jest.mock('../data/apiClient', () => ({
  apiClient: { post: jest.fn(() => Promise.resolve({})) },
}));

import { apiClient } from '../data/apiClient';
import MoreFeaturesCard from './MoreFeaturesCard';

global.IS_REACT_ACT_ENVIRONMENT = true;

function mount(props = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(<MoreFeaturesCard {...props} />));
  return { container, unmount: () => { act(() => root.unmount()); container.remove(); } };
}

afterEach(() => {
  apiClient.post.mockClear();
  delete window.subtleformsAdmin;
});

test('shows a short list and one link to the product page', () => {
  const { container, unmount } = mount({ data: { show: true, url: 'https://subtleforms.com/pro/' } });
  const card = container.querySelector('.sf-more-features');
  expect(card).not.toBeNull();
  expect(card.textContent).toMatch(/separate plugin/);
  const links = card.querySelectorAll('a');
  expect(links).toHaveLength(1);
  expect(links[0].getAttribute('href')).toBe('https://subtleforms.com/pro/');
  expect(links[0].getAttribute('href')).not.toMatch(/utm_/);
  expect(links[0].getAttribute('rel')).toContain('noopener');
  // Information only: no licence words, no upgrade or unlock wording.
  expect(card.textContent).not.toMatch(/licen[cs]e|upgrade|unlock|trial/i);
  unmount();
});

test('reads its data from the page and shows nothing when the server says no', () => {
  window.subtleformsAdmin = { moreFeatures: { show: false, url: 'https://subtleforms.com/pro/' } };
  const { container, unmount } = mount();
  expect(container.querySelector('.sf-more-features')).toBeNull();
  unmount();
});

test('shows nothing without data', () => {
  const { container, unmount } = mount();
  expect(container.innerHTML).toBe('');
  unmount();
});

test('dismiss hides it and stores the choice for the user', () => {
  window.subtleformsAdmin = { moreFeatures: { show: true, url: 'https://subtleforms.com/pro/' } };
  const { container, unmount } = mount();
  const button = container.querySelector('.sf-more-features__dismiss');
  expect(button.getAttribute('aria-label')).toBe('Dismiss');
  act(() => button.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  expect(container.querySelector('.sf-more-features')).toBeNull();
  expect(apiClient.post).toHaveBeenCalledWith('/more-features/dismiss', {});
  unmount();
});
