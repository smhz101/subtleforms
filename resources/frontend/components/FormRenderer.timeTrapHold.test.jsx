/**
 * A visitor who sends before the time trap's minimum is held in the browser
 * until it has passed, then sent, instead of being dropped by the server
 * (issue 126).
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';
import FormRenderer from './FormRenderer';

global.IS_REACT_ACT_ENVIRONMENT = true;

const reply = (status, body) => ({
  status,
  ok: status < 400,
  json: async () => body,
  clone() {
    return this;
  },
});

const schema = {
  metadata: {},
  fields: [{ id: 'a', key: 'name', type: 'text', label: 'Name', required: false }],
};

const advance = (ms) => act(async () => { await jest.advanceTimersByTimeAsync(ms); });
const button = (container) => container.querySelector('button[type="submit"]');
const click = (el) => act(async () => { el.click(); });

async function mount(props) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<FormRenderer formId={31} preloadedSchema={schema} preloadedSpamToken="t1.1700000000.31.ticket" {...props} />);
  });
  await advance(0);
  return { container, root };
}

describe('time trap hold (issue 126)', () => {
  let submits;

  beforeEach(() => {
    jest.useFakeTimers();
    submits = [];
    global.fetch = jest.fn(async (url, init = {}) => {
      if (String(url).includes('/spam-token')) {
        return reply(200, { data: { spam_token: 't1.1700000000.31.exchanged' } });
      }
      if (String(url).includes('/submit')) {
        submits.push(JSON.parse(init.body));
        return reply(200, { data: { success: true } });
      }
      return reply(404, {});
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    jest.useRealTimers();
  });

  it('sends nothing until 4000 ms after mount, then exactly one request', async () => {
    const { container } = await mount({ preloadedSpamMinSeconds: 3 });
    await advance(500);
    await click(button(container));
    await advance(3000);
    expect(submits).toHaveLength(0);
    await advance(499);
    expect(submits).toHaveLength(0);
    await advance(2);
    expect(submits).toHaveLength(1);
    await advance(5000);
    expect(submits).toHaveLength(1);
  });

  it('a second click during the wait sends nothing extra', async () => {
    const { container } = await mount({ preloadedSpamMinSeconds: 3 });
    await advance(500);
    await click(button(container));
    await advance(1000);
    await click(button(container));
    await advance(6000);
    expect(submits).toHaveLength(1);
  });

  it('sends at once when the form has no time trap', async () => {
    const { container } = await mount({ preloadedSpamMinSeconds: 0 });
    await click(button(container));
    await advance(0);
    expect(submits).toHaveLength(1);
  });

  it('sends nothing when the form unmounts during the wait', async () => {
    const { container, root } = await mount({ preloadedSpamMinSeconds: 3 });
    await advance(500);
    await click(button(container));
    await advance(1000);
    await act(async () => { root.unmount(); });
    await advance(10000);
    expect(submits).toHaveLength(0);
  });
});
