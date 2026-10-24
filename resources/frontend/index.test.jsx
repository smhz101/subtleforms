/**
 * 2.6.0 front-end speed: a block container (which also carries the shortcode
 * container class) is mounted once, with its block options, so the form is
 * loaded once and drawn once.
 */
import { act } from 'react';

global.IS_REACT_ACT_ENVIRONMENT = true;

test('each form container is mounted and loaded once', async () => {
  document.body.innerHTML = `
    <div class="subtleforms-form-container" data-form-id="7" data-features="date"></div>
    <div class="subtleforms-block subtleforms-form-container" data-form-id="8" data-theme="default"></div>
  `;
  const calls = [];
  global.fetch = jest.fn((url) => {
    calls.push(String(url));
    return new Promise(() => {});
  });

  await act(async () => {
    require('./index');
  });

  // Mount resolves schema before paint; wait for the route calls.
  const schemaCalls = (id) => calls.filter((url) => url.endsWith(`/forms/${id}/schema`)).length;
  for (let i = 0; i < 50 && (schemaCalls(7) === 0 || schemaCalls(8) === 0); i++) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
  }
  expect(schemaCalls(7)).toBe(1);
  expect(schemaCalls(8)).toBe(1);

  // Mounting again (a page builder re-running scripts) reuses the same
  // root: the form is not loaded a second time.
  const block = document.querySelector('.subtleforms-block');
  await act(async () => {
    window.SubtleForms.mount(block, { formId: 8 });
  });
  expect(schemaCalls(8)).toBe(1);
});

test('a form whose data the server printed is drawn without a request', async () => {
  jest.resetModules();
  document.body.innerHTML = `
    <script type="application/json" id="sf-form-data-9"></script>
    <div class="subtleforms-form-container" data-form-id="9" data-reserve="1"><div class="subtleforms-skeleton">Name</div></div>
  `;
  document.getElementById('sf-form-data-9').textContent = JSON.stringify({
    form: { id: 9, title: 'Inline' },
    schema: {
      metadata: { title: 'Inline form' },
      fields: [{ id: 'f1', key: 'name', type: 'text', label: 'Your name' }],
    },
    spam_token: 'v1.1700000000.9.abcdefabcdefabcdefabcdefabcdefab',
  });
  global.fetch = jest.fn(() => new Promise(() => {}));
  delete window.SubtleForms;

  await act(async () => {
    require('./index');
  });
  // The container was handed over in the same tick: no loading line.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  expect(global.fetch).not.toHaveBeenCalled();
  const container = document.querySelector('.subtleforms-form-container');
  expect(container.querySelector('.subtleforms-loading')).toBeNull();
  expect(container.querySelector('.subtleforms-skeleton')).toBeNull();
  expect(container.textContent).toContain('Your name');
});

test('without printed data the form is still loaded from the route', async () => {
  jest.resetModules();
  document.body.innerHTML = '<div class="subtleforms-form-container" data-form-id="10"></div>';
  const calls = [];
  global.fetch = jest.fn((url) => {
    calls.push(String(url));
    return new Promise(() => {});
  });
  delete window.SubtleForms;
  await act(async () => {
    require('./index');
  });
  // The route call can land a tick after mount under a busy test runner.
  const routeCalls = () => calls.filter((u) => u.endsWith('/forms/10/schema'));
  for (let i = 0; i < 50 && routeCalls().length === 0; i++) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
  }
  expect(routeCalls()).toHaveLength(1);
});

test('a hanging schema fetch never flashes Loading form text', async () => {
  jest.resetModules();
  document.body.innerHTML =
    '<div class="subtleforms-form-container" data-form-id="11"><div class="subtleforms-skeleton">Keep me</div></div>';
  global.fetch = jest.fn(() => new Promise(() => {}));
  delete window.SubtleForms;

  await act(async () => {
    require('./index');
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 40));
  });

  const container = document.querySelector('.subtleforms-form-container');
  expect(container.querySelector('.subtleforms-loading')).toBeNull();
  expect(container.textContent).not.toContain('Loading form');
  expect(container.querySelector('.subtleforms-skeleton')).not.toBeNull();
});

test('a remount during prepare uses the latest options', async () => {
  jest.resetModules();
  document.body.innerHTML =
    '<div class="subtleforms-form-container" data-form-id="12"></div>';
  let resolveFetch;
  global.fetch = jest.fn(
    () =>
      new Promise((resolve) => {
        resolveFetch = resolve;
      })
  );
  delete window.SubtleForms;

  await act(async () => {
    require('./index');
  });

  const container = document.querySelector('.subtleforms-form-container');
  for (let i = 0; i < 50 && !container._subtleformsPreparing; i++) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
  }
  expect(container._subtleformsPreparing).toBeTruthy();

  await act(async () => {
    window.SubtleForms.mount(container, {
      formId: 12,
      schema: {
        metadata: {},
        fields: [{ id: 'f', key: 'n', type: 'text', label: 'From pending' }],
      },
    });
  });

  await act(async () => {
    resolveFetch({
      ok: true,
      json: async () => ({
        data: {
          schema: {
            metadata: {},
            fields: [{ id: 'f', key: 'n', type: 'text', label: 'From first' }],
          },
          spam_token: '',
        },
      }),
    });
  });

  for (let i = 0; i < 50 && !container.textContent.includes('From pending'); i++) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
  }
  expect(container.textContent).toContain('From pending');
  expect(container.textContent).not.toContain('From first');
});
