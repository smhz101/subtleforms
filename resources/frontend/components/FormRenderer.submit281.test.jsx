/**
 * Sending a form: the retry after a 409 with a fresh submit token (issue 83)
 * and the lock a form with AJAX off keeps while the browser posts (issue 84).
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';
import FormRenderer from './FormRenderer';

global.IS_REACT_ACT_ENVIRONMENT = true;

const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 30)); });

const reply = (status, body) => ({
  status,
  ok: status < 400,
  json: async () => body,
  clone() {
    return this;
  },
});

async function mount(props) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<FormRenderer {...props} />);
  });
  await flush();
  return { container, root };
}

const schema = (required = false) => ({
  metadata: {},
  fields: [{ id: 'a', key: 'name', type: 'text', label: 'Name', required }],
});

const submitButton = (container) => container.querySelector('button[type="submit"]');

const click = (el) => act(async () => { el.click(); });

async function type(container, value) {
  const input = container.querySelector('input:not([data-subtleforms-honeypot]):not([type="hidden"])');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  await act(async () => {
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('time trap: a 409 with a fresh submit token (issue 83)', () => {
  let submits;

  const run = async (answers) => {
    submits = [];
    global.fetch = jest.fn(async (url, init = {}) => {
      if (String(url).includes('/spam-token')) {
        return reply(200, { data: { spam_token: 't1.1700000000.31.exchanged' } });
      }
      if (String(url).includes('/submit')) {
        submits.push(JSON.parse(init.body));
        return answers[Math.min(submits.length - 1, answers.length - 1)];
      }
      return reply(404, {});
    });
    const view = await mount({
      formId: 31,
      preloadedSchema: schema(),
      preloadedSpamToken: 't1.1700000000.31.ticket',
    });
    await type(view.container, 'Ada');
    await click(submitButton(view.container));
    await flush();
    return view;
  };

  const expired = reply(409, {
    error: {
      code: 'subtleforms_token_expired',
      message: 'This form was open for a long time. Please send it again.',
      meta: { spam_token: 't1.1700000001.31.fresh' },
    },
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('sends the same answers once more with the token the server returned', async () => {
    const view = await run([expired, reply(200, { data: { success: true } })]);
    expect(submits).toHaveLength(2);
    expect(submits[0].data.form_rendered_at).toBe('t1.1700000000.31.exchanged');
    expect(submits[1].data.form_rendered_at).toBe('t1.1700000001.31.fresh');
    expect(submits[1].data.name).toBe('Ada');
    expect(view.container.textContent).not.toContain('Please send it again');
    expect(view.container.querySelector('.subtleforms-confirmation, [role="status"], [role="alert"]')).not.toBeNull();
  });

  it('retries once, not in a loop, and then shows the message', async () => {
    const view = await run([expired]);
    expect(submits).toHaveLength(2);
    expect(view.container.textContent).toContain('Please send it again');
    expect(submitButton(view.container).disabled).toBe(false);
  });

  it('does not retry a 409 that carries no token', async () => {
    const view = await run([reply(409, { error: { message: 'Taken.' } })]);
    expect(submits).toHaveLength(1);
    expect(view.container.textContent).toContain('Taken.');
  });
});

describe('AJAX off: one post per click (issue 84)', () => {
  let posts;
  const original = window.HTMLFormElement.prototype.submit;

  beforeEach(() => {
    posts = 0;
    window.HTMLFormElement.prototype.submit = function () {
      posts += 1;
    };
    global.fetch = jest.fn(async () => reply(404, {}));
  });

  afterEach(() => {
    window.HTMLFormElement.prototype.submit = original;
    document.body.innerHTML = '';
  });

  it('posts once when the button is clicked twice in a row', async () => {
    const view = await mount({ formId: 41, preloadedSchema: schema(), blockOptions: { ajax: false } });
    const button = submitButton(view.container);
    await act(async () => {
      button.click();
      button.click();
    });
    await flush();
    await click(button);
    await flush();
    expect(posts).toBe(1);
    expect(button.disabled).toBe(true);
    expect(button.textContent).toContain('Submitting');
  });

  it('leaves the form free when the answers are refused before anything is posted', async () => {
    const view = await mount({ formId: 42, preloadedSchema: schema(true), blockOptions: { ajax: false } });
    await click(submitButton(view.container));
    await flush();
    expect(posts).toBe(0);
    expect(submitButton(view.container).disabled).toBe(false);

    await type(view.container, 'Ada');
    await click(submitButton(view.container));
    await flush();
    expect(posts).toBe(1);
  });

  it('unlocks when the page is brought back from the back-forward cache', async () => {
    const view = await mount({ formId: 43, preloadedSchema: schema(), blockOptions: { ajax: false } });
    await click(submitButton(view.container));
    await flush();
    expect(posts).toBe(1);
    expect(submitButton(view.container).disabled).toBe(true);

    await act(async () => {
      const event = new Event('pageshow');
      event.persisted = true;
      window.dispatchEvent(event);
    });
    expect(submitButton(view.container).disabled).toBe(false);
    await click(submitButton(view.container));
    await flush();
    expect(posts).toBe(2);
  });

  it('still posts through AJAX when AJAX is on', async () => {
    global.fetch = jest.fn(async () => reply(200, { data: { success: true } }));
    const view = await mount({ formId: 44, preloadedSchema: schema() });
    await click(submitButton(view.container));
    await flush();
    expect(posts).toBe(0);
    expect(global.fetch.mock.calls.some(([url]) => String(url).includes('/submit'))).toBe(true);
  });
});
