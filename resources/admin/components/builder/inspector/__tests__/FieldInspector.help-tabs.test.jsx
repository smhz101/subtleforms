/**
 * Help icons with tooltips, the Settings and Styles tabs, and the focus ring.
 */
import { act } from 'react';
import { readFileSync } from 'fs';
import { join } from 'path';
import { mountInspector, openTab } from '../testing/inspectorHarness';

const HELP = 'Shown under the field to guide the visitor.';

const helpButton = (container) => container.querySelector('button.sf-help[aria-label="About Help text"]');
const tip = () => document.body.querySelector('[role="tooltip"]');
const fire = (el, type) => act(() => el.dispatchEvent(new MouseEvent(type, { bubbles: true })));

beforeEach(() => {
  window.localStorage.clear();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
  document.body.innerHTML = '';
});

describe('help icons', () => {
  test('a setting with help text has an info button named About {label}, after its label', () => {
    const h = mountInspector('text');
    const button = helpButton(h.container);
    expect(button).not.toBeNull();
    expect(button.getAttribute('type')).toBe('button');
    // The button follows the label inside the row head, not inside the label.
    const head = button.parentElement;
    expect(head.className).toBe('sf-prow__head');
    expect(head.querySelector('label').contains(button)).toBe(false);
    // A setting without help text has no button: Label has none.
    expect(h.container.querySelector('button.sf-help[aria-label="About Label"]')).toBeNull();
    h.unmount();
  });

  test('focus shows the tooltip at once, and blur or Escape closes it', () => {
    const h = mountInspector('text');
    const button = helpButton(h.container);
    expect(tip()).toBeNull();
    act(() => button.focus());
    expect(tip()).not.toBeNull();
    expect(tip().textContent).toBe(HELP);
    expect(button.getAttribute('aria-describedby')).toBe(tip().id);
    act(() => {
      button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(tip()).toBeNull();
    act(() => button.focus());
    act(() => button.blur());
    expect(tip()).toBeNull();
    h.unmount();
  });

  test('hover shows it after 300ms, and leaving closes it', () => {
    const h = mountInspector('text');
    const button = helpButton(h.container);
    fire(button, 'mouseover');
    expect(tip()).toBeNull();
    act(() => jest.advanceTimersByTime(299));
    expect(tip()).toBeNull();
    act(() => jest.advanceTimersByTime(2));
    expect(tip()).not.toBeNull();
    fire(button, 'mouseout');
    expect(tip()).toBeNull();
    h.unmount();
  });

  test('the control points at a hidden copy of the help text', () => {
    const h = mountInspector('text');
    const input = [...h.container.querySelectorAll('input, textarea')].find(
      (el) => el.id && h.container.querySelector(`label[for="${el.id}"]`)?.textContent === 'Help text'
    );
    const copy = h.container.querySelector(`#${input.getAttribute('aria-describedby')}`);
    expect(copy.textContent).toBe(HELP);
    expect(copy.className).toContain('sf-prow__help');
    h.unmount();
  });

  test('the text is shown exactly as the definition gives it: mixed case, trailing period', () => {
    const h = mountInspector('text');
    act(() => helpButton(h.container).focus());
    expect(tip().textContent).toBe('Shown under the field to guide the visitor.');
    expect(tip().textContent).not.toBe(tip().textContent.toUpperCase());
    // No stylesheet in the panel changes the case of the tooltip.
    const css = readFileSync(join(__dirname, '../../FieldInspector.scss'), 'utf8');
    const rule = css.slice(css.indexOf('.sf-help-tip {'));
    expect(rule.slice(0, rule.indexOf('\n}'))).toContain('text-transform: none');
    h.unmount();
  });
});

describe('Settings and Styles tabs', () => {
  const tabs = (container) => [...container.querySelectorAll('[role="tab"]')];

  test('two icon tabs, Settings first, with labels, a roving tabindex and a panel', () => {
    const h = mountInspector('text');
    const [settings, styles] = tabs(h.container);
    expect(settings.getAttribute('aria-label')).toBe('Field settings');
    expect(styles.getAttribute('aria-label')).toBe('Field styles');
    expect(settings.textContent).toBe('');
    expect(settings.getAttribute('aria-selected')).toBe('true');
    expect(settings.tabIndex).toBe(0);
    expect(styles.tabIndex).toBe(-1);
    const panel = h.container.querySelector('[role="tabpanel"]');
    expect(settings.getAttribute('aria-controls')).toBe(panel.id);
    expect(panel.getAttribute('aria-labelledby')).toBe(settings.id);
    h.unmount();
  });

  test('clicking Styles switches the panel, and arrow keys move between tabs', () => {
    const h = mountInspector('text');
    expect(h.container.querySelector('[data-section="content"]')).not.toBeNull();
    openTab(h.container, 'styles');
    expect(tabs(h.container)[1].getAttribute('aria-selected')).toBe('true');
    expect(h.container.querySelector('[data-section="content"]')).toBeNull();
    expect(h.container.querySelector('[data-section="style-label"]')).not.toBeNull();
    act(() => {
      tabs(h.container)[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    });
    expect(tabs(h.container)[0].getAttribute('aria-selected')).toBe('true');
    expect(h.container.querySelector('[data-section="content"]')).not.toBeNull();
    h.unmount();
  });

  test('the active tab is remembered for the browser, Settings by default', () => {
    const h = mountInspector('text');
    openTab(h.container, 'styles');
    expect(window.localStorage.getItem('sf-inspector-tab')).toBe('styles');
    h.unmount();
    const next = mountInspector('dropdown');
    expect(tabs(next.container)[1].getAttribute('aria-selected')).toBe('true');
    next.unmount();
    window.localStorage.clear();
    const fresh = mountInspector('text');
    expect(tabs(fresh.container)[0].getAttribute('aria-selected')).toBe('true');
    fresh.unmount();
  });

  test('works when storage is blocked', () => {
    const get = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const set = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const h = mountInspector('text');
    openTab(h.container, 'styles');
    expect(tabs(h.container)[1].getAttribute('aria-selected')).toBe('true');
    h.unmount();
    get.mockRestore();
    set.mockRestore();
  });

  test('a field with nothing to style has no tabs and shows Settings', () => {
    window.localStorage.setItem('sf-inspector-tab', 'styles');
    const h = mountInspector('step');
    expect(tabs(h.container)).toHaveLength(0);
    expect(h.container.querySelector('[data-section="content"]')).not.toBeNull();
    h.unmount();
  });
});

describe('focus', () => {
  const css = readFileSync(join(__dirname, '../../FieldInspector.scss'), 'utf8');

  test('every kind of control has a 2px accent outline with a 2px offset on focus', () => {
    expect(css).toContain('$sf-focus: 2px solid var(--sf-brand);');
    // Each selector below is followed, in its own rule, by the shared focus outline.
    ['&:focus {', '&:focus-within {', '&:focus-visible {'].forEach((selector) => {
      expect(css).toContain(selector);
    });
    const outlines = css.match(/outline: \$sf-focus;/g) || [];
    expect(outlines.length).toBeGreaterThan(15);
    expect(css).toMatch(/&:focus \{\s+border-color: var\(--sf-brand\);\s+outline: \$sf-focus;\s+outline-offset: 2px;/);
  });

  test('a row that holds the focus gets a faint accent background', () => {
    expect(css).toMatch(/\.sf-prow \{[^}]*&:focus-within \{\s+background: \$sf-row-tint;/s);
    expect(css).toContain('$sf-row-tint: color-mix(in srgb, var(--sf-brand) 4%, transparent);');
  });

  test('the controls carry the classes that style them', () => {
    const h = mountInspector('dropdown');
    expect(h.container.querySelector('input.sf-prow__input')).not.toBeNull();
    expect(h.container.querySelector('.sf-prow--stacked')).not.toBeNull();
    expect(h.container.querySelector('.sf-prow--inline')).not.toBeNull();
    expect(h.container.querySelector('.sf-seg__option')).not.toBeNull();
    h.unmount();
  });
});
