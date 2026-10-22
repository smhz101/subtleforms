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

  const schemaCalls = (id) => calls.filter((url) => url.endsWith(`/forms/${id}/schema`)).length;
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
