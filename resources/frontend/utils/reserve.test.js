/**
 * UX2-27: the reserved height is released once the form is drawn.
 */
import { releaseReserve } from './reserve';

function container() {
  const el = document.createElement('div');
  el.setAttribute('data-reserve', '1');
  document.body.appendChild(el);
  return el;
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('releaseReserve (UX2-27)', () => {
  test('keeps the height while the loading text shows', async () => {
    const el = container();
    releaseReserve(el);
    el.innerHTML = '<div class="subtleforms-loading">Loading form...</div>';
    await flush();
    expect(el.hasAttribute('data-reserve')).toBe(true);
  });

  test('releases it when the form replaces the loading text', async () => {
    const el = container();
    releaseReserve(el);
    el.innerHTML = '<div class="subtleforms-loading">Loading form...</div>';
    await flush();
    el.innerHTML = '<div class="subtleforms subtleforms--type-default"><form></form></div>';
    await flush();
    expect(el.hasAttribute('data-reserve')).toBe(false);
  });

  test('releases it when the form shows an error', async () => {
    const el = container();
    releaseReserve(el);
    el.innerHTML = '<div class="subtleforms-error">Form not found</div>';
    await flush();
    expect(el.hasAttribute('data-reserve')).toBe(false);
  });

  test('gives up after the timeout so a broken form leaves no gap', () => {
    jest.useFakeTimers();
    const el = container();
    releaseReserve(el, { timeoutMs: 100 });
    jest.advanceTimersByTime(150);
    expect(el.hasAttribute('data-reserve')).toBe(false);
    jest.useRealTimers();
  });

  test('a container without a reserved height is left alone', () => {
    const el = document.createElement('div');
    expect(() => releaseReserve(el)()).not.toThrow();
  });
});
