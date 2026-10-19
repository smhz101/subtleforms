/**
 * UX2-16: on a window shorter than the WordPress admin menu, the menu
 * scrolls in its own column (AdminShell.scss, `.sf-menu-scrolls`) so the
 * page never grows taller than the window. While the menu fits, the class
 * is off and the menu behaves as in core, hover flyouts included.
 */

/**
 * Whether the admin menu is taller than the space under the admin bar.
 *
 * @param {Document} doc Document.
 * @param {Window}   win Window.
 * @return {boolean}
 */
export function menuOverflows(doc, win) {
  const menu = doc.getElementById('adminmenu');
  if (!menu) return false;
  const bar = doc.getElementById('wpadminbar');
  const barHeight = bar ? bar.getBoundingClientRect().height : 0;
  return menu.getBoundingClientRect().height > win.innerHeight - barHeight;
}

/**
 * Keep `sf-menu-scrolls` on <body> in step with the window and menu size.
 *
 * @param {Document} doc Document.
 * @param {Window}   win Window.
 * @return {Function} Stops watching.
 */
export function watchMenuFit(doc = document, win = window) {
  const update = () => {
    doc.body.classList.toggle('sf-menu-scrolls', menuOverflows(doc, win));
  };
  update();
  win.addEventListener('resize', update);
  let observer = null;
  const menu = doc.getElementById('adminmenu');
  if (menu && typeof win.ResizeObserver === 'function') {
    // Folding the menu or opening a submenu changes its height.
    observer = new win.ResizeObserver(update);
    observer.observe(menu);
  }
  return () => {
    win.removeEventListener('resize', update);
    if (observer) observer.disconnect();
  };
}
