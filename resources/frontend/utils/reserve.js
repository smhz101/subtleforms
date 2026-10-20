/**
 * UX2-27: the server prints the form container at the estimated height of
 * the form (data-reserve, FormPlaceholder.php). Once the form itself (not
 * the loading text) is in the container, that height is released, in the
 * same frame, so the page does not jump twice.
 */

const isDrawn = (container) =>
  !!container.querySelector('.subtleforms, .subtleforms-error') &&
  !container.querySelector('.subtleforms-loading');

/**
 * Release the reserved height once the form is drawn.
 *
 * @param {HTMLElement} container Form container.
 * @param {Object}      [opts]
 * @param {Window}      [opts.win]       Window (tests).
 * @param {number}      [opts.timeoutMs] Give up after this long.
 * @return {Function} Stops watching.
 */
export function releaseReserve(container, { win = window, timeoutMs = 8000 } = {}) {
  if (!container || !container.hasAttribute('data-reserve')) {
    return () => {};
  }
  let observer = null;
  let timer = null;
  const release = () => {
    container.removeAttribute('data-reserve');
    if (observer) observer.disconnect();
    if (timer) win.clearTimeout(timer);
  };
  if (isDrawn(container)) {
    release();
    return () => {};
  }
  observer = new win.MutationObserver(() => {
    if (isDrawn(container)) release();
  });
  observer.observe(container, { childList: true, subtree: true });
  // A form that never draws (a script error) must not keep the gap.
  timer = win.setTimeout(release, timeoutMs);
  return release;
}
