/**
 * UX2-16: the admin menu scrolls in its own column only while it is taller
 * than the window, so the SubtleForms stage always fills the window.
 */
import { menuOverflows, watchMenuFit } from './menuFit';

function setup(menuHeight) {
  document.body.className = '';
  document.body.innerHTML = '<div id="wpadminbar"></div><ul id="adminmenu"></ul>';
  document.getElementById('wpadminbar').getBoundingClientRect = () => ({ height: 32 });
  document.getElementById('adminmenu').getBoundingClientRect = () => ({ height: menuHeight });
}

describe('menuFit (UX2-16)', () => {
  test('a menu taller than the window below the admin bar overflows', () => {
    setup(722);
    expect(menuOverflows(document, { innerHeight: 600 })).toBe(true);
    expect(menuOverflows(document, { innerHeight: 900 })).toBe(false);
  });

  test('the body class follows window resizes', () => {
    setup(722);
    const listeners = {};
    const win = {
      innerHeight: 600,
      addEventListener: (type, fn) => { listeners[type] = fn; },
      removeEventListener: (type) => { delete listeners[type]; },
    };
    const stop = watchMenuFit(document, win);
    expect(document.body.classList.contains('sf-menu-scrolls')).toBe(true);

    win.innerHeight = 900;
    listeners.resize();
    expect(document.body.classList.contains('sf-menu-scrolls')).toBe(false);

    stop();
    expect(listeners.resize).toBeUndefined();
  });

  test('the menu margins count: a menu 12px short of the space still overflows with its 24px of margin', () => {
    setup(556); // 600 - 32 (admin bar) = 568 available; 556 + 24 margin = 580.
    const win = { innerHeight: 600, getComputedStyle: () => ({ marginTop: '12px', marginBottom: '12px' }) };
    expect(menuOverflows(document, win)).toBe(true);
    const noMargin = { innerHeight: 600, getComputedStyle: () => ({ marginTop: '0px', marginBottom: '0px' }) };
    expect(menuOverflows(document, noMargin)).toBe(false);
  });

  test('no menu, no class', () => {
    document.body.innerHTML = '';
    expect(menuOverflows(document, { innerHeight: 100 })).toBe(false);
  });
});
