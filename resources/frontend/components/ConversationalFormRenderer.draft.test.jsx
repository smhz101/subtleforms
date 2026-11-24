/**
 * A conversational form reopens on the question the visitor was on, and
 * starts empty after a successful send (issue 139).
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';
import ConversationalFormRenderer from './ConversationalFormRenderer';

global.IS_REACT_ACT_ENVIRONMENT = true;

const reply = (status, body) => ({ status, ok: status < 400, json: async () => body, clone() { return this; } });

const schema = {
  metadata: { type: 'conversational' },
  fields: [
    { id: 'a', key: 'first', type: 'text', label: 'First' },
    { id: 'b', key: 'second', type: 'text', label: 'Second' },
  ],
};

const advance = (ms) => act(async () => { await jest.advanceTimersByTimeAsync(ms); });
const click = (el) => act(async () => { el.click(); });
const input = (c, key) => c.querySelector(`#subtleforms-field-${key}`);
const next = (c) => c.querySelector('.subtleforms-button-next');
async function type(el, value) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function mount(formId = 51) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<ConversationalFormRenderer formId={formId} schema={schema} spamToken="t1.1700000000.51.ticket" />);
  });
  await advance(0);
  return { container, root };
}

describe('conversational draft (issue 139)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    window.sessionStorage.clear();
    global.fetch = jest.fn(async (url) =>
      String(url).includes('/submit') ? reply(200, { data: { success: true } }) : reply(200, { data: { spam_token: 't1.1700000000.51.x' } })
    );
  });
  afterEach(() => {
    document.body.innerHTML = '';
    jest.useRealTimers();
  });

  it('reopens on the same question with earlier answers', async () => {
    const a = await mount();
    await type(input(a.container, 'first'), 'Ann');
    await click(next(a.container));
    await type(input(a.container, 'second'), 'Par');
    await advance(500);
    await act(async () => a.root.unmount());
    const b = await mount();
    expect(input(b.container, 'first')).toBeNull();
    expect(input(b.container, 'second').value).toBe('Par');
  });

  it('starts empty after a successful send', async () => {
    const a = await mount();
    await type(input(a.container, 'first'), 'Ann');
    await click(next(a.container));
    await type(input(a.container, 'second'), 'Par');
    await click(next(a.container));
    await advance(5000);
    await click(next(a.container));
    await advance(10000);
    await act(async () => a.root.unmount());
    expect(window.sessionStorage.length).toBe(0);
    const b = await mount();
    expect(input(b.container, 'first').value).toBe('');
  });
});
