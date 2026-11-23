/**
 * The email notification editor says who the mail comes from (GH119-03).
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';

jest.mock('./ActionsPanel.scss', () => ({}), { virtual: true });

import { SenderNote, actionFromHeader } from './ActionsPanel';

global.IS_REACT_ACT_ENVIRONMENT = true;

function text(props = {}) {
  const container = document.createElement('div');
  const root = createRoot(container);
  act(() => root.render(<SenderNote {...props} />));
  const out = container.textContent;
  act(() => root.unmount());
  return out;
}

afterEach(() => { delete window.subtleformsData; });

test('shows the configured sender', () => {
  window.subtleformsData = { senderName: 'Tooltique', senderEmail: 'enquiries@tooltique.co.uk', siteDomain: 'www.tooltique.co.uk' };
  expect(text()).toContain('Sent from: Tooltique <enquiries@tooltique.co.uk>.');
  expect(text()).toContain('Change it in Settings, Email.');
});

test('falls back to the WordPress default without www', () => {
  window.subtleformsData = { senderName: '', senderEmail: '', siteDomain: 'www.tooltique.co.uk' };
  expect(text()).toContain('the WordPress default (wordpress@tooltique.co.uk)');
});

test('shows the notification\'s own From header instead of the site sender', () => {
  window.subtleformsData = { senderName: 'Tooltique', senderEmail: 'enquiries@tooltique.co.uk', siteDomain: 'tooltique.co.uk' };
  const out = text({ headers: ['Reply-To: a@b.co', 'From: Sales <sales@tooltique.co.uk>'] });
  expect(out).toContain('Sent from: Sales <sales@tooltique.co.uk>, set on this notification.');
  expect(out).not.toContain('Change it in Settings, Email.');
});

test('reads the From header from a list or an object, case-insensitively', () => {
  expect(actionFromHeader(['from:  a@b.co '])).toBe('a@b.co');
  expect(actionFromHeader({ FROM: 'x@y.z' })).toBe('x@y.z');
  expect(actionFromHeader(['Reply-To: a@b.co'])).toBe('');
  expect(actionFromHeader(undefined)).toBe('');
});
