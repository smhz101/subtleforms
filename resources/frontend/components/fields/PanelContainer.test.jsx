/**
 * Tabs and Accordion on the live form (2.9.0): roles, keyboard, closed
 * panels that stay mounted, error badges, logic and the narrow-screen
 * accordion.
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';
import FieldRenderer from '../FieldRenderer';
import { FormContext } from './contexts';
import { revealField } from '../../utils/revealField';

global.IS_REACT_ACT_ENVIRONMENT = true;

const text = (key) => ({ id: `n_${key}`, key, type: 'text', label: key });
const tabPanel = (key, children, extra = {}) => ({ id: `p_${key}`, key, type: 'tab_panel', label: key.toUpperCase(), children, ...extra });
const section = (key, children, extra = {}) => ({ id: `s_${key}`, key, type: 'accordion_panel', label: key.toUpperCase(), children, ...extra });

const tabsField = (extra = {}, panels) => ({
  id: 'tabs1',
  key: 'tabs1',
  type: 'tabs_container',
  label: 'Details',
  position: 'top',
  collapse_mobile: true,
  active: 0,
  children: panels || [tabPanel('one', [text('a')]), tabPanel('two', [text('b')]), tabPanel('three', [text('c')])],
  ...extra,
});

const accordionField = (extra = {}, panels) => ({
  id: 'acc1',
  key: 'acc1',
  type: 'accordion_container',
  label: 'More',
  multiple: false,
  open: 'first',
  icon: 'chevron',
  children: panels || [section('x', [text('a')]), section('y', [text('b')]), section('z', [text('c')])],
  ...extra,
});

let root;
let container;

async function mount(field, { errors = {}, hidden = [], context } = {}) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  const element = (
    <FormContext.Provider value={context || { formId: 1, preview: false }}>
      <FieldRenderer
        field={field}
        values={{}}
        onChange={() => {}}
        errors={errors}
        hiddenFields={new Set(hidden)}
      />
    </FormContext.Provider>
  );
  await act(async () => {
    root.render(element);
  });
  return { rerender: (next) => act(async () => root.render(next)) };
}

function mockMatchMedia(matches) {
  const listeners = new Set();
  window.matchMedia = jest.fn().mockImplementation((query) => ({
    matches,
    media: query,
    addEventListener: (_e, fn) => listeners.add(fn),
    removeEventListener: (_e, fn) => listeners.delete(fn),
    addListener: (fn) => listeners.add(fn),
    removeListener: (fn) => listeners.delete(fn),
  }));
  return listeners;
}

const key = (el, k) => act(async () => {
  el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
});

afterEach(async () => {
  await act(async () => root?.unmount());
  document.body.innerHTML = '';
  delete window.matchMedia;
});

describe('Tabs', () => {
  it('draws the exact roles and attributes', async () => {
    mockMatchMedia(false);
    await mount(tabsField());
    const wrap = container.querySelector('.subtleforms-tabs');
    expect(wrap.classList.contains('subtleforms-tabs--top')).toBe(true);
    expect(wrap.hasAttribute('data-sf-tabs')).toBe(true);
    const list = wrap.querySelector('[role="tablist"]');
    expect(list.getAttribute('aria-label')).toBe('Details');
    const tabs = [...wrap.querySelectorAll('[role="tab"]')];
    expect(tabs).toHaveLength(3);
    tabs.forEach((tab, n) => {
      expect(tab.tagName).toBe('BUTTON');
      expect(tab.getAttribute('type')).toBe('button');
      expect(tab.id.endsWith(`-tab-${n}`)).toBe(true);
      expect(tab.getAttribute('aria-controls')).toBe(tab.id.replace('-tab-', '-panel-'));
      expect(tab.getAttribute('aria-selected')).toBe(n === 0 ? 'true' : 'false');
      expect(tab.getAttribute('tabindex')).toBe(n === 0 ? '0' : '-1');
    });
    const panels = [...wrap.querySelectorAll('[role="tabpanel"]')];
    expect(panels).toHaveLength(3);
    panels.forEach((panel, n) => {
      expect(panel.getAttribute('aria-labelledby')).toBe(tabs[n].id);
      expect(panel.hidden).toBe(n !== 0);
      expect(panel.getAttribute('tabindex')).toBe('0');
    });
  });

  it('keeps every panel mounted so closed fields keep existing', async () => {
    mockMatchMedia(false);
    await mount(tabsField());
    expect(container.querySelectorAll('input[type="text"]')).toHaveLength(3);
  });

  it('names the tab list Sections without a label', async () => {
    mockMatchMedia(false);
    await mount(tabsField({ label: '' }));
    expect(container.querySelector('[role="tablist"]').getAttribute('aria-label')).toBe('Sections');
  });

  it('opens the tab chosen to show first', async () => {
    mockMatchMedia(false);
    await mount(tabsField({ active: 2 }));
    const tabs = [...container.querySelectorAll('[role="tab"]')];
    expect(tabs.map((t) => t.getAttribute('aria-selected'))).toEqual(['false', 'false', 'true']);
  });

  it('switches on click', async () => {
    mockMatchMedia(false);
    await mount(tabsField());
    const tabs = [...container.querySelectorAll('[role="tab"]')];
    await act(async () => tabs[1].click());
    expect(tabs[1].getAttribute('aria-selected')).toBe('true');
    expect([...container.querySelectorAll('[role="tabpanel"]')].map((p) => p.hidden)).toEqual([true, false, true]);
  });

  it('moves focus and selection with Left and Right, wrapping, and with Home and End', async () => {
    mockMatchMedia(false);
    await mount(tabsField());
    const list = container.querySelector('[role="tablist"]');
    const tabs = () => [...container.querySelectorAll('[role="tab"]')];
    tabs()[0].focus();
    await key(tabs()[0], 'ArrowRight');
    expect(tabs()[1].getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(tabs()[1]);
    await key(tabs()[1], 'End');
    expect(document.activeElement).toBe(tabs()[2]);
    expect(tabs()[2].getAttribute('aria-selected')).toBe('true');
    await key(tabs()[2], 'ArrowRight');
    expect(document.activeElement).toBe(tabs()[0]);
    await key(tabs()[0], 'ArrowLeft');
    expect(document.activeElement).toBe(tabs()[2]);
    await key(tabs()[2], 'Home');
    expect(document.activeElement).toBe(tabs()[0]);
    expect(list.getAttribute('aria-orientation')).toBe('horizontal');
  });

  it('uses Up and Down when the tabs are on the left', async () => {
    mockMatchMedia(false);
    await mount(tabsField({ position: 'left' }));
    expect(container.querySelector('.subtleforms-tabs').classList.contains('subtleforms-tabs--left')).toBe(true);
    const tabs = () => [...container.querySelectorAll('[role="tab"]')];
    tabs()[0].focus();
    await key(tabs()[0], 'ArrowRight');
    expect(tabs()[0].getAttribute('aria-selected')).toBe('true');
    await key(tabs()[0], 'ArrowDown');
    expect(tabs()[1].getAttribute('aria-selected')).toBe('true');
    await key(tabs()[1], 'ArrowUp');
    expect(tabs()[0].getAttribute('aria-selected')).toBe('true');
    expect(container.querySelector('[role="tablist"]').getAttribute('aria-orientation')).toBe('vertical');
  });

  it('shows an error badge on the tab, described for screen readers', async () => {
    mockMatchMedia(false);
    const field = tabsField({}, [
      tabPanel('one', [text('a')]),
      tabPanel('two', [text('b'), text('c')]),
    ]);
    await mount(field, { errors: { b: 'Required', c: 'Required' } });
    const tabs = [...container.querySelectorAll('[role="tab"]')];
    expect(tabs[0].querySelector('.subtleforms-tab-badge')).toBeNull();
    const badge = tabs[1].querySelector('.subtleforms-tab-badge');
    expect(badge.textContent).toBe('2');
    expect(badge.getAttribute('aria-label')).toBe('2 errors');
    expect(tabs[1].getAttribute('aria-describedby')).toBe(badge.id);
    expect(tabs[0].hasAttribute('aria-describedby')).toBe(false);
  });

  it('counts the errors of a repeater row under its panel', async () => {
    mockMatchMedia(false);
    const repeater = { id: 'r', key: 'rows', type: 'repeat_container', label: 'Rows', children: [text('qty')] };
    await mount(tabsField({}, [tabPanel('one', [repeater]), tabPanel('two', [text('b')])]), {
      errors: { 'rows.0.qty': 'Required' },
    });
    expect(container.querySelector('[role="tab"] .subtleforms-tab-badge').textContent).toBe('1');
  });

  it('does not draw a panel that logic hides, and picks the first visible tab', async () => {
    mockMatchMedia(false);
    await mount(tabsField({ active: 0 }), { hidden: ['one', 'a'] });
    const tabs = [...container.querySelectorAll('[role="tab"]')];
    expect(tabs.map((t) => t.textContent)).toEqual(['TWO', 'THREE']);
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    expect(container.querySelectorAll('[role="tabpanel"]')).toHaveLength(2);
    expect(container.querySelector('input[name="a"]')).toBeNull();
  });

  it('draws nothing when logic hides every panel', async () => {
    mockMatchMedia(false);
    await mount(tabsField(), { hidden: ['one', 'two', 'three'] });
    expect(container.querySelector('.subtleforms-tabs')).toBeNull();
  });

  it('keeps the open tab in the form state across a redraw', async () => {
    mockMatchMedia(false);
    const context = { formId: 1, preview: false, panelState: new Map() };
    await mount(tabsField(), { context });
    await act(async () => container.querySelectorAll('[role="tab"]')[2].click());
    await act(async () => root.unmount());
    document.body.innerHTML = '';
    await mount(tabsField(), { context });
    expect(container.querySelectorAll('[role="tab"]')[2].getAttribute('aria-selected')).toBe('true');
  });

  it('draws an accordion on narrow screens when asked to, one section open at a time', async () => {
    mockMatchMedia(true);
    await mount(tabsField());
    expect(container.querySelector('[data-sf-tabs]')).toBeNull();
    const triggers = [...container.querySelectorAll('.subtleforms-accordion-trigger')];
    expect(triggers).toHaveLength(3);
    expect(triggers.map((t) => t.getAttribute('aria-expanded'))).toEqual(['true', 'false', 'false']);
    await act(async () => triggers[1].click());
    expect(triggers.map((t) => t.getAttribute('aria-expanded'))).toEqual(['false', 'true', 'false']);
    await act(async () => triggers[1].click());
    expect(triggers.map((t) => t.getAttribute('aria-expanded'))).toEqual(['false', 'false', 'false']);
  });

  describe('measures the window that owns the container (preview iframe)', () => {
    // A second document stands in for the builder preview iframe; its
    // defaultView is a fake window with its own matchMedia.
    async function mountInOtherDocument(innerMatches) {
      const other = document.implementation.createHTMLDocument('preview');
      const asked = [];
      Object.defineProperty(other, 'defaultView', {
        configurable: true,
        value: {
          matchMedia: (query) => {
            asked.push(query);
            return {
              matches: innerMatches,
              media: query,
              addEventListener() {},
              removeEventListener() {},
            };
          },
        },
      });
      container = other.createElement('div');
      other.body.appendChild(container);
      root = createRoot(container);
      await act(async () => {
        root.render(
          <FormContext.Provider value={{ formId: 1, preview: true }}>
            <FieldRenderer field={tabsField()} values={{}} onChange={() => {}} errors={{}} hiddenFields={new Set()} />
          </FormContext.Provider>
        );
      });
      return asked;
    }

    it('collapses to an accordion when the iframe is narrow and the admin window is wide', async () => {
      mockMatchMedia(false);
      const asked = await mountInOtherDocument(true);
      expect(asked).toContain('(max-width: 600px)');
      expect(window.matchMedia).not.toHaveBeenCalled();
      expect(container.querySelector('[data-sf-tabs]')).toBeNull();
      expect(container.querySelectorAll('.subtleforms-accordion-trigger')).toHaveLength(3);
    });

    it('keeps tabs when the iframe is wide and the admin window is narrow', async () => {
      mockMatchMedia(true);
      await mountInOtherDocument(false);
      expect(window.matchMedia).not.toHaveBeenCalled();
      expect(container.querySelector('[data-sf-tabs]')).not.toBeNull();
    });
  });

  it('stays tabs on narrow screens when the setting is off', async () => {
    mockMatchMedia(true);
    await mount(tabsField({ collapse_mobile: false }));
    expect(container.querySelector('[data-sf-tabs]')).not.toBeNull();
    expect(container.querySelector('[data-sf-accordion]')).toBeNull();
  });

  it('draws tabs on wide screens and before the browser has answered', async () => {
    delete window.matchMedia;
    await mount(tabsField());
    expect(container.querySelector('[data-sf-tabs]')).not.toBeNull();
  });
});

describe('Accordion', () => {
  it('draws headings, buttons and regions with the exact markup', async () => {
    await mount(accordionField());
    const wrap = container.querySelector('.subtleforms-accordion');
    expect(wrap.hasAttribute('data-sf-accordion')).toBe(true);
    const headings = [...wrap.querySelectorAll('h3.subtleforms-accordion-heading')];
    expect(headings).toHaveLength(3);
    const trigger = headings[0].querySelector('button.subtleforms-accordion-trigger');
    expect(trigger.getAttribute('type')).toBe('button');
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(trigger.id.endsWith('-trigger-0')).toBe(true);
    expect(trigger.getAttribute('aria-controls')).toBe(trigger.id.replace('-trigger-', '-region-'));
    expect(trigger.querySelector('.subtleforms-accordion-icon').getAttribute('aria-hidden')).toBe('true');
    const regions = [...wrap.querySelectorAll('[role="region"]')];
    expect(regions).toHaveLength(3);
    expect(regions[0].getAttribute('aria-labelledby')).toBe(trigger.id);
    expect(regions.map((r) => r.hidden)).toEqual([false, true, true]);
    expect(container.querySelectorAll('input[type="text"]')).toHaveLength(3);
  });

  it.each([
    ['first', ['true', 'false', 'false']],
    ['none', ['false', 'false', 'false']],
    ['all', ['true', 'true', 'true']],
  ])('open at start: %s', async (open, expected) => {
    await mount(accordionField({ open }));
    expect([...container.querySelectorAll('button[aria-expanded]')].map((b) => b.getAttribute('aria-expanded'))).toEqual(expected);
  });

  it('closes the others when one opens, unless several may be open', async () => {
    await mount(accordionField());
    let triggers = [...container.querySelectorAll('button[aria-expanded]')];
    await act(async () => triggers[2].click());
    expect(triggers.map((b) => b.getAttribute('aria-expanded'))).toEqual(['false', 'false', 'true']);
    await act(async () => root.unmount());
    document.body.innerHTML = '';
    await mount(accordionField({ multiple: true }));
    triggers = [...container.querySelectorAll('button[aria-expanded]')];
    await act(async () => triggers[2].click());
    expect(triggers.map((b) => b.getAttribute('aria-expanded'))).toEqual(['true', 'false', 'true']);
    await act(async () => triggers[0].click());
    expect(triggers.map((b) => b.getAttribute('aria-expanded'))).toEqual(['false', 'false', 'true']);
  });

  it('moves between headers with Up, Down, Home and End', async () => {
    await mount(accordionField());
    const triggers = [...container.querySelectorAll('button[aria-expanded]')];
    triggers[0].focus();
    await key(triggers[0], 'ArrowDown');
    expect(document.activeElement).toBe(triggers[1]);
    await key(triggers[1], 'End');
    expect(document.activeElement).toBe(triggers[2]);
    await key(triggers[2], 'ArrowUp');
    expect(document.activeElement).toBe(triggers[1]);
    await key(triggers[1], 'Home');
    expect(document.activeElement).toBe(triggers[0]);
    // Moving focus does not open anything.
    expect(triggers.map((b) => b.getAttribute('aria-expanded'))).toEqual(['true', 'false', 'false']);
  });

  it('shows an error badge on a closed section header', async () => {
    await mount(accordionField(), { errors: { b: 'Required' } });
    const trigger = container.querySelectorAll('button[aria-expanded]')[1];
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.querySelector('.subtleforms-tab-badge').textContent).toBe('1');
    expect(trigger.getAttribute('aria-describedby')).toBe(trigger.querySelector('.subtleforms-tab-badge').id);
  });

  it('uses the plus and minus icon when chosen', async () => {
    await mount(accordionField({ icon: 'plus' }));
    expect(container.querySelector('.subtleforms-accordion--plus')).not.toBeNull();
  });

  it('skips a section that logic hides', async () => {
    await mount(accordionField(), { hidden: ['y', 'b'] });
    expect(container.querySelectorAll('h3.subtleforms-accordion-heading')).toHaveLength(2);
  });
});

describe('revealField', () => {
  it('opens a closed tab, then lets the field take focus', async () => {
    mockMatchMedia(false);
    await mount(tabsField());
    const input = container.querySelector('input[name="b"]');
    expect(input.closest('[role="tabpanel"]').hidden).toBe(true);
    await act(async () => {
      await revealField(input);
    });
    expect(input.closest('[role="tabpanel"]').hidden).toBe(false);
    expect(container.querySelectorAll('[role="tab"]')[1].getAttribute('aria-selected')).toBe('true');
    input.focus();
    expect(document.activeElement).toBe(input);
  });

  it('opens a closed accordion section', async () => {
    await mount(accordionField());
    const input = container.querySelector('input[name="c"]');
    await act(async () => {
      await revealField(input);
    });
    expect(input.closest('[role="region"]').hidden).toBe(false);
    expect(container.querySelectorAll('button[aria-expanded="true"]')).toHaveLength(1);
  });

  it('opens a tab inside an accordion section inside a tab', async () => {
    mockMatchMedia(false);
    const innerTabs = {
      id: 'inner_tabs',
      key: 'inner_tabs',
      type: 'tabs_container',
      label: 'Inner',
      children: [tabPanel('i1', [text('first')]), tabPanel('i2', [text('deep')])],
    };
    const acc = accordionField({ open: 'none' }, [section('s1', [text('plain')]), section('s2', [innerTabs])]);
    const outer = tabsField({}, [tabPanel('o1', [text('top')]), tabPanel('o2', [acc])]);
    // Tabs inside an accordion inside Tabs is deeper than the builder allows,
    // but the reveal must still walk every closed ancestor it finds.
    await mount(outer);
    const deep = container.querySelector('input[name="deep"]');
    const closed = () => {
      let n = 0;
      for (let el = deep.parentElement; el; el = el.parentElement) {
        if (el.matches('[role="tabpanel"][hidden], [role="region"][hidden]')) n += 1;
      }
      return n;
    };
    expect(closed()).toBe(3);
    await act(async () => {
      await revealField(deep);
    });
    expect(closed()).toBe(0);
    deep.focus();
    expect(document.activeElement).toBe(deep);
  });

  it('resolves for a field that is already visible', async () => {
    mockMatchMedia(false);
    await mount(tabsField());
    const input = container.querySelector('input[name="a"]');
    await expect(revealField(input)).resolves.toBe(false);
    await expect(revealField(null)).resolves.toBe(false);
  });
});
