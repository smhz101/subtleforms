/**
 * The email notification editor says who the mail comes from (GH119-03).
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';

jest.mock('./ActionsPanel.scss', () => ({}), { virtual: true });

import { SenderNote } from './ActionsPanel';

global.IS_REACT_ACT_ENVIRONMENT = true;

function text() {
  const container = document.createElement('div');
  const root = createRoot(container);
  act(() => root.render(<SenderNote />));
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
