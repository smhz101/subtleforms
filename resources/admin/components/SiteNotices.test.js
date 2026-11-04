jest.mock('./SiteNotices.scss', () => ({}));
import { act } from 'react';
import { createElement, render, unmountComponentAtNode } from '@wordpress/element';
import { screen, fireEvent } from '@testing-library/dom';
import SiteNotices from './SiteNotices';

function notice(cls, text) {
  const el = document.createElement('div');
  el.className = `notice ${cls}`;
  el.innerHTML = `<p>${text}</p>`;
  return el;
}

describe('SiteNotices', () => {
  let wpbody;
  let host;
  beforeEach(() => {
    document.body.innerHTML = '<div id="wpbody-content"><div class="wrap"><div id="subtleforms-admin-app"></div></div></div>';
    wpbody = document.getElementById('wpbody-content');
    host = document.getElementById('subtleforms-admin-app');
  });
  afterEach(() => {
    act(() => {
      unmountComponentAtNode(host);
    });
    document.body.innerHTML = '';
    document.body.className = '';
  });

  async function mount() {
    await act(async () => {
      render(createElement(SiteNotices), host);
    });
  }

  test('moves notices from the page top into a labelled region', async () => {
    wpbody.insertBefore(notice('notice-success', 'Purged all caches successfully.'), wpbody.firstChild);
    await mount();
    const region = screen.getByRole('region', { name: 'Notices' });
    expect(region.textContent).toContain('Purged all caches successfully.');
    expect(wpbody.querySelector(':scope > .notice')).toBeNull();
    expect(document.body.classList.contains('sf-notices-managed')).toBe(true);
  });

  test('moves notices added after mount', async () => {
    await mount();
    await act(async () => {
      wpbody.appendChild(notice('notice-warning', 'Late one'));
      await Promise.resolve();
    });
    expect(screen.getByRole('region', { name: 'Notices' }).textContent).toContain('Late one');
  });

  test('folds notices after the second behind a button', async () => {
    ['One', 'Two', 'Three', 'Four'].forEach((t) => wpbody.appendChild(notice('notice-info', t)));
    await mount();
    const button = screen.getByRole('button', { name: 'Show 2 more notices' });
    expect(button.getAttribute('aria-expanded')).toBe('false');
    const list = document.querySelector('.sf-site-notices__list');
    expect(list.querySelectorAll('.sf-site-notice--folded').length).toBe(2);
    await act(async () => {
      fireEvent.click(button);
    });
    expect(list.querySelectorAll('.sf-site-notice--folded').length).toBe(0);
    expect(screen.getByRole('button', { name: 'Show fewer notices' })).toBeTruthy();
  });

  test('two notices show no button', async () => {
    ['One', 'Two'].forEach((t) => wpbody.appendChild(notice('notice-info', t)));
    await mount();
    expect(screen.queryByRole('button')).toBeNull();
  });

  test('notices survive unmount in a stash and clear the managed class', async () => {
    wpbody.appendChild(notice('notice-info', 'Keep me'));
    await mount();
    act(() => {
      unmountComponentAtNode(host);
    });
    expect(document.body.classList.contains('sf-notices-managed')).toBe(false);
    expect(document.getElementById('sf-notice-stash').textContent).toContain('Keep me');
  });
});
