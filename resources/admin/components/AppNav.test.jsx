/**
 * The Submissions badge in the plugin navigation is the total number of
 * entries, short from 1,000 up, with a tooltip and a screen reader label that
 * say what it counts. The unread count is not shown here.
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';
jest.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: '/' }),
  useNavigate: () => jest.fn(),
}));

import AppNav, { totalLabel } from './AppNav';

global.IS_REACT_ACT_ENVIRONMENT = true;

function mount() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(<AppNav />));
  return { container, unmount: () => { act(() => root.unmount()); container.remove(); } };
}

afterEach(() => {
  delete window.subtleformsAdmin;
});

describe('AppNav Submissions badge', () => {
  test('shows the total, not the unread count', () => {
    window.subtleformsAdmin = { unreadCount: 3, totalCount: 128 };
    const { container, unmount } = mount();
    const badge = container.querySelector('.sf-appnav__count');
    expect(badge).not.toBeNull();
    expect(badge.querySelector('[aria-hidden="true"]').textContent).toBe('128');
    expect(badge.getAttribute('title')).toBe('128 submissions in total');
    expect(badge.querySelector('.screen-reader-text').textContent).toBe('128 submissions in total');
    unmount();
  });

  test('is exact up to 999 and short after that', () => {
    window.subtleformsAdmin = { totalCount: 999 };
    let view = mount();
    expect(view.container.querySelector('.sf-appnav__count [aria-hidden]').textContent).toBe('999');
    view.unmount();

    window.subtleformsAdmin = { totalCount: 1234 };
    view = mount();
    const badge = view.container.querySelector('.sf-appnav__count');
    expect(badge.querySelector('[aria-hidden]').textContent).toBe('1.2k');
    // The label keeps the exact number.
    expect(badge.getAttribute('title')).toBe((1234).toLocaleString() + ' submissions in total');
    view.unmount();

    window.subtleformsAdmin = { totalCount: 12500 };
    view = mount();
    expect(view.container.querySelector('.sf-appnav__count [aria-hidden]').textContent).toBe('12k');
    view.unmount();
  });

  test('has no badge when there are no entries', () => {
    window.subtleformsAdmin = { unreadCount: 0, totalCount: 0 };
    const { container, unmount } = mount();
    expect(container.querySelector('.sf-appnav__count')).toBeNull();
    unmount();
  });

  test('the label is singular for one entry', () => {
    expect(totalLabel(1)).toBe('1 submission in total');
  });
});
