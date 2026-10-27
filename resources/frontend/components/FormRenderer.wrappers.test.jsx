/**
 * P1-01: add-ons wrap the public form through registerFormWrapper(). A
 * wrapper reads the answers, may add to them or stop the submit before it
 * is sent, and may name the submit button. Without one the form is the
 * plain form.
 */
import { createRoot, useEffect } from '@wordpress/element';
import { act } from 'react';
import FormRenderer from './FormRenderer';
import { registerFormWrapper } from '../../shared/extend';

jest.mock('../utils/restFetch', () => ({
  restUrl: '/wp-json/subtleforms/v1',
  restNonce: () => '',
  restRouteUrl: (p) => p,
  restFetch: jest.fn(async () => ({
    ok: true,
    json: async () => ({ data: { success: true, submission_id: 7, confirmation: { type: 'message', message: 'Thanks' } } }),
  })),
}));
jest.mock('../utils/spamToken', () => ({
  createSpamTokenSource: () => ({ prime: () => {}, take: async () => 'token' }),
}));

const { restFetch } = require('../utils/restFetch');

global.IS_REACT_ACT_ENVIRONMENT = true;

const schema = {
  metadata: {},
  fields: [{ id: 'a', key: 'name', type: 'text', label: 'Name' }],
};

async function mount(formId) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<FormRenderer preloadedSchema={schema} formId={formId} />);
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 30));
  });
  return { container, unmount: () => act(() => root.unmount()) };
}

async function submit(container) {
  const button = container.querySelector('button[type="submit"]');
  await act(async () => {
    button.click();
    await new Promise((r) => setTimeout(r, 30));
  });
}

afterEach(() => {
  delete window.__subtleformsExtend.wrappers.example;
  restFetch.mockClear();
});

test('without a wrapper the form submits as before', async () => {
  const { container, unmount } = await mount(31);
  expect(container.querySelector('button[type="submit"]').textContent).toBe('Submit');
  await submit(container);
  const call = restFetch.mock.calls.find(([path]) => path === '/submit');
  expect(call).toBeTruthy();
  expect(call[1].body.data._example).toBeUndefined();
  unmount();
});

test('a wrapper names the button and adds to the answers', async () => {
  let seen = null;
  registerFormWrapper('example', function Example({ form, children }) {
    seen = form;
    useEffect(() => {
      form.setSubmitLabel('Send it');
      return form.onBeforeSubmit(async ({ payload }) => {
        payload._example = 'ref';
        return null;
      });
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
    return <div className='example-wrapper'>{children}</div>;
  });
  const { container, unmount } = await mount(32);
  expect(container.querySelector('.example-wrapper form')).not.toBeNull();
  expect(seen.formId).toBe(32);
  expect(seen.fields.map((f) => f.key || f.config?.key)).toContain('name');
  expect(container.querySelector('button[type="submit"]').textContent).toBe('Send it');
  await submit(container);
  const call = restFetch.mock.calls.find(([path]) => path === '/submit');
  expect(call[1].body.data._example).toBe('ref');
  expect(container.textContent).toContain('Thanks');
  unmount();
});

test('a wrapper can stop the submit with a message', async () => {
  registerFormWrapper('example', function Example({ form, children }) {
    useEffect(() => form.onBeforeSubmit(async () => ({ stop: true, message: 'Not now.' })), []); // eslint-disable-line react-hooks/exhaustive-deps
    return children;
  });
  const { container, unmount } = await mount(33);
  await submit(container);
  expect(restFetch.mock.calls.find(([path]) => path === '/submit')).toBeUndefined();
  expect(container.querySelector('.subtleforms-error').textContent).toBe('Not now.');
  unmount();
});
