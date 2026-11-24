/**
 * A multi-step form keeps its step and answers across a reload, and starts
 * empty after a successful send (issue 139).
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';
import FormRenderer from './FormRenderer';

global.IS_REACT_ACT_ENVIRONMENT = true;

const reply = (status, body) => ({ status, ok: status < 400, json: async () => body, clone() { return this; } });

const schema = {
  metadata: { type: 'multi-step' },
  fields: [
    { id: 's1', type: 'step', config: { label: 'One' }, children: [{ id: 'a', key: 'first', type: 'text', label: 'First' }] },
    { id: 's2', type: 'step', config: { label: 'Two' }, children: [{ id: 'b', key: 'second', type: 'text', label: 'Second' }] },
  ],
};

const advance = (ms) => act(async () => { await jest.advanceTimersByTimeAsync(ms); });
const click = (el) => act(async () => { el.click(); });
const input = (c, key) => c.querySelector(`#subtleforms-field-${key}`);
async function type(el, value) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

const roots = [];
async function mount(formId = 41) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<FormRenderer formId={formId} preloadedSchema={schema} preloadedSpamToken="t1.1700000000.41.ticket" />);
  });
  await advance(50);
  roots.push(root);
  return { container, root };
}

describe('multi-step draft (issue 139)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    window.sessionStorage.clear();
    global.fetch = jest.fn(async (url) =>
      String(url).includes('/submit') ? reply(200, { data: { success: true } }) : reply(200, { data: { spam_token: 't1.1700000000.41.x' } })
    );
  });
  afterEach(async () => {
    await act(async () => roots.splice(0).forEach((r) => { r.unmount() }));
    document.body.innerHTML = '';
    jest.useRealTimers();
  });

  it('reopens on the same step with answers', async () => {
    const a = await mount();
    await type(input(a.container, 'first'), 'Ann');
    await click(a.container.querySelector('.subtleforms-button-next'));
    await type(input(a.container, 'second'), 'Par');
    await advance(500);
    await act(async () => a.root.unmount());
    const b = await mount();
    expect(input(b.container, 'first')).toBeNull();
    expect(input(b.container, 'second').value).toBe('Par');
    await click(b.container.querySelector('.subtleforms-button-prev'));
    expect(input(b.container, 'first').value).toBe('Ann');
  });

  it('starts empty after a successful send', async () => {
    const a = await mount();
    await type(input(a.container, 'first'), 'Ann');
    await click(a.container.querySelector('.subtleforms-button-next'));
    await advance(500);
    await click(a.container.querySelector('button[type="submit"]'));
    await click(a.container.querySelector('button[type="submit"]'));
    await advance(10000);
    await act(async () => a.root.unmount());
    expect(window.sessionStorage.length).toBe(0);
    const b = await mount();
    expect(input(b.container, 'first').value).toBe('');
  });

  it('keeps separate drafts for two forms', async () => {
    const a = await mount(41);
    await type(input(a.container, 'first'), 'Ann');
    await advance(500);
    await act(async () => a.root.unmount());
    const b = await mount(42);
    expect(input(b.container, 'first').value).toBe('');
  });
});
