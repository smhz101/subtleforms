/**
 * The email notification editor has a Reply-To setting that takes one
 * address or a field tag, with the Insert tag menu (2.6.0).
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';

jest.mock('./ActionsPanel.scss', () => ({}), { virtual: true });

import ActionsPanel from './ActionsPanel';

global.IS_REACT_ACT_ENVIRONMENT = true;

const schema = {
  metadata: { title: 'Contact' },
  fields: [ { id: 'email', key: 'email', type: 'email', label: 'Email' } ],
  actions: [
    { id: 'imported_email_1', type: 'email', enabled: true, settings: { to: '{admin_email}', subject: 'Hi', message: '', format: 'html', replyTo: '{field:email}' } },
  ],
};

function mount(onChange) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(<ActionsPanel schema={schema} onChange={onChange} />));
  return { container, unmount: () => { act(() => root.unmount()); container.remove(); } };
}

function openEmail(container) {
  if (container.querySelector('input[aria-labelledby]')) {
    return;
  }
  const toggle = [ ...container.querySelectorAll('button') ].find((b) => /Email notification/.test(b.textContent) || b.getAttribute('aria-expanded') === 'false');
  act(() => toggle.dispatchEvent(new MouseEvent('click', { bubbles: true })));
}

test('Reply-To shows the imported tag and saves what is typed', () => {
  const onChange = jest.fn();
  const { container, unmount } = mount(onChange);
  openEmail(container);
  const label = [ ...container.querySelectorAll('[id^="sf-merge-tag-label-"]') ].find((el) => el.textContent === 'Reply-To');
  expect(label).toBeTruthy();
  const input = container.querySelector(`input[aria-labelledby="${ label.id }"]`);
  expect(input.value).toBe('{field:email}');
  expect(label.parentElement.parentElement.textContent).toContain('Insert tag');

  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  act(() => {
    setter.call(input, 'help@example.com');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const saved = onChange.mock.calls.at(-1)[0];
  const actions = saved.actions || saved;
  expect(actions[0].settings.replyTo).toBe('help@example.com');
  expect(actions[0].settings.to).toBe('{admin_email}');
  unmount();
});
