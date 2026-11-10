/**
 * The field settings panel as one sheet of property rows: the controls it
 * draws are the controls the tabbed panel drew, sections open and close and
 * remember it, the quick rows write the settings they stand for, and the
 * panel passes an accessibility check.
 */
import { act } from 'react';
import axe from 'axe-core';
import { readFileSync } from 'fs';
import { join } from 'path';
import { collectControlLabels, mountInspector, openEverything } from '../testing/inspectorHarness';
import before from '../testing/fixtures/controlLabels.before.json';

// The short names the Rules section gives the two messages. The settings and
// their saved keys are unchanged; only the row label is shorter.
const SHORT_NAMES = {
  'Message when left empty': 'If empty',
  'Custom validation message': 'If invalid',
};

const SECTIONS = ['content', 'choices', 'dropdowns', 'subfields', 'type', 'rules', 'logic', 'style', 'advanced'];

const sectionIds = (container) => [...container.querySelectorAll('[data-section]')].map((s) => s.dataset.section);
const toggle = (container, id) => container.querySelector(`[data-section="${id}"] .sf-isec__toggle`);
const click = (el) => act(() => el.click());

function setValue(el, value) {
  const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
  act(() => {
    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('one sheet, no tabs', () => {
  test.each(Object.keys(before))('%s: the same controls as the tabbed panel', (type) => {
    const h = mountInspector(type);
    expect(h.container.querySelector('[role="tab"]')).toBeNull();
    openEverything(h.container);
    const after = collectControlLabels(h.container);
    const expected = [...new Set(before[type].map((name) => SHORT_NAMES[name] || name))].sort();
    expect(after).toEqual(expected);
    h.unmount();
  });

  test('sections come in order: quick rows, Content, Choices, Rules, Logic, Style, Advanced', () => {
    const h = mountInspector('dropdown');
    expect(sectionIds(h.container)).toEqual(['quick', 'content', 'choices', 'rules', 'logic', 'style', 'advanced']);
    h.unmount();
  });

  test('a section with nothing for the field type is not drawn', () => {
    const step = mountInspector('step');
    expect(sectionIds(step.container).filter((id) => id !== 'quick')).toEqual(['content']);
    expect(step.container.querySelector('[data-section="quick"]')).toBeNull();
    step.unmount();
    const html = mountInspector('html');
    expect(sectionIds(html.container)).not.toContain('rules');
    expect(sectionIds(html.container)).not.toContain('quick');
    html.unmount();
    const address = mountInspector('address_group');
    expect(sectionIds(address.container)).toContain('subfields');
    address.unmount();
    const repeater = mountInspector('repeat_container');
    expect(sectionIds(repeater.container)).toEqual(['content', 'type', 'logic', 'style', 'advanced']);
    repeater.unmount();
  });

  test('section headers are buttons that name their state', () => {
    const h = mountInspector('dropdown');
    SECTIONS.forEach((id) => {
      const btn = toggle(h.container, id);
      if (!btn) return;
      expect(btn.tagName).toBe('BUTTON');
      expect(btn.getAttribute('aria-expanded')).toMatch(/true|false/);
      expect(btn.getAttribute('aria-controls')).toBeTruthy();
    });
    h.unmount();
  });
});

describe('sections collapse and remember it', () => {
  test('Style and Advanced start closed, the others open', () => {
    const h = mountInspector('dropdown');
    const state = Object.fromEntries(sectionIds(h.container).filter((id) => id !== 'quick').map((id) => [id, toggle(h.container, id).getAttribute('aria-expanded')]));
    expect(state).toEqual({ content: 'true', choices: 'true', rules: 'true', logic: 'true', style: 'false', advanced: 'false' });
    h.unmount();
  });

  test('closing a section saves it for the browser, for every field', () => {
    const h = mountInspector('text');
    click(toggle(h.container, 'content'));
    expect(toggle(h.container, 'content').getAttribute('aria-expanded')).toBe('false');
    expect(window.localStorage.getItem('sf-inspector-content')).toBe('closed');
    click(toggle(h.container, 'advanced'));
    expect(window.localStorage.getItem('sf-inspector-advanced')).toBe('open');
    h.unmount();

    // Another field, a new mount: the choice is kept.
    const next = mountInspector('dropdown');
    expect(toggle(next.container, 'content').getAttribute('aria-expanded')).toBe('false');
    expect(toggle(next.container, 'advanced').getAttribute('aria-expanded')).toBe('true');
    next.unmount();
  });

  test('works when storage is blocked', () => {
    const get = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const set = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const h = mountInspector('text');
    click(toggle(h.container, 'content'));
    expect(toggle(h.container, 'content').getAttribute('aria-expanded')).toBe('false');
    h.unmount();
    get.mockRestore();
    set.mockRestore();
  });

  test('a closed section draws none of its settings', () => {
    const h = mountInspector('text');
    expect(h.container.querySelector('[data-section="content"] input')).not.toBeNull();
    click(toggle(h.container, 'content'));
    expect(h.container.querySelector('[data-section="content"] input')).toBeNull();
    h.unmount();
  });
});

describe('quick rows', () => {
  test('Required reflects the field and writes the same setting', () => {
    const h = mountInspector('text');
    const required = h.container.querySelector('[data-section="quick"] input[type="checkbox"]');
    expect(required.checked).toBe(false);
    expect(h.container.querySelector('[data-section="quick"]').textContent).toContain('visitors may skip');
    click(required);
    expect(h.builder.actions.onUpdate).toHaveBeenCalledWith('n_text', { required: true });
    h.render({ ...h.field, required: true });
    expect(h.container.querySelector('[data-section="quick"]').textContent).toContain('must answer');
    h.unmount();
  });

  test('Required is not drawn again in Rules or Content', () => {
    const h = mountInspector('text');
    openEverything(h.container);
    const names = collectControlLabels(h.container);
    expect(names.filter((n) => n === 'Required')).toHaveLength(1);
    expect(h.container.querySelector('[data-section="rules"]').textContent).not.toContain('Required');
    h.unmount();
  });

  test('Width reflects the field and writes the same appearance', () => {
    const h = mountInspector('text', { fieldOverrides: { appearance: { marginTop: '8px' } } });
    const group = h.container.querySelector('[data-section="quick"] [role="radiogroup"]');
    expect(group).not.toBeNull();
    const half = [...group.querySelectorAll('input[type="radio"]')].find((r) => r.value === '50');
    click(half);
    expect(h.builder.actions.onUpdate).toHaveBeenCalledWith('n_text', { appearance: { marginTop: '8px', width: '50' } });
    h.render({ ...h.field, appearance: { width: '50' } });
    expect([...h.container.querySelectorAll('[data-section="quick"] input[type="radio"]')].find((r) => r.checked).value).toBe('50');
    // Auto clears the key.
    const auto = [...h.container.querySelectorAll('[data-section="quick"] input[type="radio"]')].find((r) => r.value === '');
    click(auto);
    expect(h.builder.actions.onUpdate).toHaveBeenLastCalledWith('n_text', { appearance: {} });
    h.unmount();
  });

  test('Width is not drawn again in Style', () => {
    const h = mountInspector('text');
    click(toggle(h.container, 'style'));
    expect(h.container.querySelector('[data-section="style"] [role="radiogroup"][aria-label="Width"]')).toBeNull();
    h.unmount();
  });

  test('a block that takes no answer keeps Width in Style and has no quick rows', () => {
    const h = mountInspector('html');
    click(toggle(h.container, 'style'));
    expect(h.container.querySelector('[data-section="style"] [role="radiogroup"][aria-label="Width"]')).not.toBeNull();
    h.unmount();
  });

  test('Visibility says Shown, or Rule-based when a rule exists, and opens Logic', () => {
    const h = mountInspector('text');
    const chip = () => [...h.container.querySelectorAll('[data-section="quick"] button')].find((b) => /Shown|Rule-based/.test(b.textContent));
    expect(chip().textContent).toBe('Shown');
    click(toggle(h.container, 'logic'));
    expect(toggle(h.container, 'logic').getAttribute('aria-expanded')).toBe('false');
    click(chip());
    expect(toggle(h.container, 'logic').getAttribute('aria-expanded')).toBe('true');
    h.render({
      ...h.field,
      logic: { action: 'show', groups: [{ match: 'all', rules: [{ field: 'other', operator: 'equals', value: 'x' }] }] },
    });
    expect(chip().textContent).toBe('Rule-based');
    h.unmount();
  });
});

describe('header actions', () => {
  test('Paste list opens the bulk editor and Apply saves the same options', () => {
    const h = mountInspector('dropdown');
    const action = h.container.querySelector('[data-section="choices"] .sf-isec__action');
    expect(action.textContent).toBe('Paste list');
    click(action);
    const area = h.container.querySelector('[data-section="choices"] textarea');
    expect(area).not.toBeNull();
    expect(area.value).toBe('First choice|first\nSecond choice|second');
    expect(action.textContent).toBe('Cancel');
    setValue(area, 'One\nTwo\nThree');
    const apply = [...h.container.querySelectorAll('[data-section="choices"] button')].find((b) => b.textContent === 'Apply');
    click(apply);
    const call = h.builder.actions.onUpdate.mock.calls.at(-1);
    expect(call[0]).toBe('n_drop');
    expect(call[1].options.map((o) => o.label)).toEqual(['One', 'Two', 'Three']);
    h.unmount();
  });

  test('Paste list opens a closed Choices section', () => {
    const h = mountInspector('dropdown');
    click(toggle(h.container, 'choices'));
    click(h.container.querySelector('[data-section="choices"] .sf-isec__action'));
    expect(toggle(h.container, 'choices').getAttribute('aria-expanded')).toBe('true');
    expect(h.container.querySelector('[data-section="choices"] textarea')).not.toBeNull();
    h.unmount();
  });

  test('+ Rule uses the Logic editor to add a rule, and opens a closed section first', () => {
    const h = mountInspector('text', { allFields: [{ key: 'other', label: 'Other', type: 'text' }] });
    click(toggle(h.container, 'logic'));
    click(h.container.querySelector('[data-section="logic"] .sf-isec__action'));
    expect(toggle(h.container, 'logic').getAttribute('aria-expanded')).toBe('true');
    const call = h.builder.actions.onUpdate.mock.calls.at(-1);
    expect(call[0]).toBe('n_text');
    expect(call[1].logic.groups[0].rules).toEqual([{ field: '', operator: 'equals', value: '' }]);
    h.unmount();
  });

  test('the empty Logic section says so', () => {
    const h = mountInspector('text');
    expect(h.container.querySelector('[data-section="logic"]').textContent).toContain(
      'No rules yet. Show, hide or require this field based on another answer.'
    );
    h.unmount();
  });
});

describe('footer', () => {
  test('lists only shortcuts the builder handles: Esc and Del', () => {
    const h = mountInspector('text');
    const footer = h.container.querySelector('.sf-field-inspector__footer');
    expect([...footer.querySelectorAll('kbd')].map((k) => k.textContent)).toEqual(['Esc', 'Del']);
    // The builder's key handler is where these come from.
    const builder = readFileSync(join(__dirname, '../../FormBuilder.jsx'), 'utf8');
    expect(builder).toContain("e.key === 'Escape'");
    expect(builder).toContain("e.key === 'Delete'");
    // No saved state is exposed to the panel, so none is claimed.
    expect(footer.textContent).not.toMatch(/saved/i);
    h.unmount();
  });
});

describe('header', () => {
  test('shows the label, the key and rename, and the three actions', () => {
    const h = mountInspector('dropdown');
    expect(h.container.querySelector('.sf-field-inspector__title').textContent).toBe('Dropdown');
    expect(h.container.querySelector('.sf-field-inspector__key code').textContent).toBe('dropdown_1');
    expect(h.container.querySelector('button[aria-label="Rename field ID"]').textContent).toBe('rename');
    ['Duplicate', 'Delete', 'Close settings'].forEach((name) => {
      expect(h.container.querySelector(`button[aria-label="${name}"]`)).not.toBeNull();
    });
    h.render({ ...h.field, label: '' });
    expect(h.container.querySelector('.sf-field-inspector__title').textContent).toBe('Dropdown');
    h.unmount();
  });
});

describe('rows', () => {
  test('Rules lists the two messages first, as If empty and If invalid', () => {
    const h = mountInspector('text');
    const labels = [...h.container.querySelectorAll('[data-section="rules"] .sf-prow__label')].map((l) => l.textContent);
    expect(labels.slice(0, 2)).toEqual(['If empty', 'If invalid']);
    const placeholder = h.container.querySelector('[data-section="rules"] input').getAttribute('placeholder');
    expect(placeholder).toBe('This field is required.');
    h.unmount();
  });

  test('help text stays in the page and is tied to its control', () => {
    const h = mountInspector('text');
    const input = [...h.container.querySelectorAll('input, textarea')].find((i) => i.id && h.container.querySelector(`label[for="${i.id}"]`)?.textContent === 'Help text');
    expect(input).toBeTruthy();
    const help = h.container.querySelector(`#${input.getAttribute('aria-describedby')}`);
    expect(help.textContent).toBe('Shown under the field to guide the visitor.');
    h.unmount();
  });

  test('a text area grows from one line', () => {
    const h = mountInspector('text');
    const area = h.container.querySelector('textarea');
    expect(area.getAttribute('rows')).toBe('1');
    h.unmount();
  });

  test('editing a text row writes the same key', () => {
    const h = mountInspector('text');
    const label = [...h.container.querySelectorAll('input')].find((i) => h.container.querySelector(`label[for="${i.id}"]`)?.textContent === 'Label');
    setValue(label, 'Full name');
    expect(h.builder.actions.onUpdate).toHaveBeenCalledWith('n_text', { label: 'Full name' });
    h.unmount();
  });
});

describe('accessibility', () => {
  const check = async (container) => {
    const results = await axe.run(container, {
      // The jsdom document has no layout: colour contrast is checked in the browser spec.
      rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
    });
    return results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
  };

  test.each(['dropdown', 'address_group'])('%s: no violations with every section open', async (type) => {
    const h = mountInspector(type);
    openEverything(h.container);
    expect(await check(h.container)).toEqual([]);
    h.unmount();
  });
});
