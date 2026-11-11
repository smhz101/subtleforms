/**
 * Show a field that sits in a closed tab or accordion section (2.9.0).
 *
 * Tabs and Accordion keep every panel in the page and hide the closed ones
 * with the `hidden` attribute. A hidden element cannot take focus, so before
 * the form moves focus to the first field with an error, it opens every tab
 * and section around that field.
 *
 * The containers register one handler per panel, keyed by the id of the
 * panel's element (`role=tabpanel` or `role=region`). revealField() walks up
 * from the field and runs the handler of each closed panel it passes, from
 * the inside out, so a tab inside a section inside a tab opens all three.
 */

const handlers = new Map();

/**
 * Register what opens a panel. Returns the function that removes it.
 *
 * @param {string}   panelId DOM id of the panel element.
 * @param {Function} open    Opens the panel.
 * @return {Function} Unregister.
 */
export function registerReveal(panelId, open) {
  if (!panelId || typeof open !== 'function') {
    return () => {};
  }
  handlers.set(panelId, open);
  return () => {
    if (handlers.get(panelId) === open) {
      handlers.delete(panelId);
    }
  };
}

/**
 * Open every closed tab and section around an element.
 *
 * @param {Element|null} el Element about to get focus.
 * @return {Promise<boolean>} Resolves after one frame, with whether anything was opened.
 */
export function revealField(el) {
  let opened = false;
  let node = el && el.parentElement;
  const closed = [];
  while (node) {
    if (
      typeof node.matches === 'function' &&
      node.matches('[role="tabpanel"][hidden], [role="region"][hidden]')
    ) {
      closed.push(node);
    }
    node = node.parentElement;
  }
  closed.forEach((panel) => {
    const open = handlers.get(panel.id);
    if (open) {
      open();
      opened = true;
    }
  });
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => resolve(opened));
    } else {
      setTimeout(() => resolve(opened), 0);
    }
  });
}
