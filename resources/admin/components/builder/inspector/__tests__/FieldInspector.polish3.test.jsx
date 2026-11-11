/**
 * Round 3 of the panel polish: no live preview of the field, one border on a
 * selected segment, the Logic editor laid out as stacked controls, label ink,
 * tabs without a box, and a header that does not depend on the scrollbar.
 */
import { act } from 'react';
import { readFileSync } from 'fs';
import { join } from 'path';
import { mountInspector, openEverything, openTab } from '../testing/inspectorHarness';

const read = (file) => readFileSync(join(__dirname, file), 'utf8');
const inspectorCss = read('../../FieldInspector.scss');
const appearanceCss = read('../../appearance/FieldAppearancePanel.scss');
const formEditorCss = read('../../FormEditor.scss');

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('no field preview in the panel', () => {
  test('the Styles tab draws no sample frame and no "Following the form" line', () => {
    const h = mountInspector('text');
    openTab(h.container, 'styles');
    openEverything(h.container);
    expect(h.container.querySelector('.sf-field-appearance__sample')).toBeNull();
    expect(h.container.querySelector('iframe')).toBeNull();
    expect(h.container.textContent).not.toMatch(/Following the form/);
    expect(h.container.querySelector('.sf-field-appearance__status')).toBeNull();
    h.unmount();
  });

  test('the Input section keeps its controls', () => {
    const h = mountInspector('text');
    openTab(h.container, 'styles');
    openEverything(h.container);
    const labels = [...h.container.querySelectorAll('[data-section="style-input"] .sf-prow__label-text')].map((l) => l.textContent);
    expect(labels).toEqual(['Placeholder', 'Default value', 'Prefix', 'Suffix']);
    h.unmount();
  });

  test('overrides keep their Clear control', () => {
    const h = mountInspector('text', { fieldOverrides: { appearance: { marginTop: '8px' } } });
    openTab(h.container, 'styles');
    const status = h.container.querySelector('.sf-field-appearance__status');
    expect(status.textContent).toContain('1 override on this field');
    const clear = [...status.querySelectorAll('button')].find((b) => b.textContent === 'Clear');
    act(() => clear.click());
    expect(h.builder.actions.onUpdate).toHaveBeenCalledWith('n_text', { appearance: {} });
    h.unmount();
  });
});

describe('segmented controls', () => {
  test('a selected segment has one border and the outline is for the keyboard only', () => {
    expect(inspectorCss).not.toMatch(/\.sf-seg[\s\S]*?&:focus-within \{\s+outline/);
    expect(inspectorCss).toMatch(/&:has\(\.sf-seg__input:focus-visible\) \{\s+outline: \$sf-focus;\s+outline-offset: 2px;/);
    expect(inspectorCss).toMatch(/&\.is-on \{\s+border-color: var\(--sf-brand\);\s+background: #fff;/);
    // The width squares of the Styles tab: one border, no inset ring.
    expect(appearanceCss).toMatch(/&\.is-active \{\s+border-color: var\(--sf-brand\);\s+background: #fff;\s+box-shadow: none;/);
    expect(appearanceCss).toContain(':has(input:focus-visible)');
  });

  test('the selected width square is the checked radio of the row', () => {
    const h = mountInspector('text', { fieldOverrides: { appearance: { width: '50' } } });
    const on = h.container.querySelectorAll('[data-section="quick"] .sf-seg__option.is-on');
    expect(on).toHaveLength(1);
    expect(on[0].textContent).toBe('½');
    h.unmount();
  });
});

describe('Logic section', () => {
  const rule = { action: 'show', groups: [{ match: 'all', rules: [{ field: 'other', operator: 'equals', value: 'x' }] }] };
  const others = [{ key: 'other', label: 'Other', type: 'text' }];

  test('the action select has a visible label and the add button is a secondary button', () => {
    const h = mountInspector('text', { allFields: others, fieldOverrides: { logic: rule } });
    openEverything(h.container);
    const logic = h.container.querySelector('[data-section="logic"]');
    expect(logic.querySelector('.sf-logic-editor--panel')).not.toBeNull();
    const label = logic.querySelector('.sf-logic-editor__action label');
    expect(label.textContent).toBe('Action');
    expect(label.closest('.components-visually-hidden')).toBeNull();
    const add = logic.querySelector('.sf-logic-editor__add-rule');
    expect(add.className).toContain('is-secondary');
    expect(logic.querySelector('.sf-logic-editor__match-note').textContent).toBe('This rule must match');
    // Field, operator and value are in one rule grid with the remove button.
    const ruleBox = logic.querySelector('.sf-logic-editor__rule');
    expect(ruleBox.querySelectorAll('select, input').length).toBe(3);
    expect(ruleBox.querySelector('button[aria-label="Remove rule"]')).not.toBeNull();
    h.unmount();
  });

  test('the empty state and the add-rule button', () => {
    const h = mountInspector('text', { allFields: others });
    openEverything(h.container);
    const logic = h.container.querySelector('[data-section="logic"]');
    expect(logic.querySelector('.sf-field-inspector__intro')).not.toBeNull();
    expect(logic.querySelector('.sf-logic-editor__empty')).not.toBeNull();
    expect(logic.querySelector('.sf-logic-editor__footer .is-secondary')).not.toBeNull();
    h.unmount();
  });

  test('the layout rules: card, caption, 32px remove column', () => {
    expect(inspectorCss).toMatch(/&__intro \{\s+margin: 0 0 12px;\s+font-size: 12px;\s+line-height: 16px;/);
    expect(inspectorCss).toMatch(/\.sf-logic-editor__group \{\s+gap: 12px;\s+padding: 12px;\s+border: 1px solid var\(--sf-border\);\s+border-radius: var\(--sf-radius-lg\);/);
    expect(inspectorCss).toContain('grid-template-columns: minmax(0, 1fr) 32px;');
    expect(inspectorCss).toMatch(/\.sf-logic-editor--panel \{[^}]*display: flex;[^}]*flex-direction: column;[^}]*gap: 12px;/);
    expect(inspectorCss).toMatch(/\.sf-logic-editor__empty \{[^}]*border: 1px dashed/);
  });
});

describe('type and spacing', () => {
  test('the section body has 16px on every side', () => {
    expect(inspectorCss).toMatch(/&__body \{\s+padding: 16px;/);
  });

  test('row labels are 11px on a 16px line, #303030, and the uppercase labels match', () => {
    expect(inspectorCss).toMatch(/&__label-text \{\s+font-size: 11px;\s+line-height: 16px;\s+color: \$sf-label-ink;/);
    expect(inspectorCss).toContain('$sf-label-ink: #303030;');
    expect(appearanceCss).toMatch(/&__label \{[^}]*color: #303030;/);
    const h = mountInspector('text');
    openEverything(h.container);
    expect(h.container.querySelector('.sf-prow__label-text')).not.toBeNull();
    h.unmount();
  });

  test('Alignment, Space above and Space below are 12px apart', () => {
    expect(appearanceCss).toMatch(/\.components-toggle-group-control \{ margin-bottom: 12px; \}/);
  });

  test('the colour swatch border is the surface colour, a little darker on keyboard focus', () => {
    const toggle = appearanceCss.slice(appearanceCss.indexOf('.sf-color-token__toggle {'));
    expect(toggle).toContain('border-color: var(--sf-bg-surface);');
    expect(toggle).toMatch(/&:hover:not\(:disabled\) \{\s+border-color: var\(--sf-bg-surface\);/);
    expect(toggle).toMatch(/&:focus-visible:not\(:disabled\) \{\s+border-color: #d4d4d4;\s+border-color: color-mix\(in srgb, var\(--sf-bg-surface\), #000 12%\);\s+outline: none !important;/);
  });
});

describe('tabs and the scrolling element', () => {
  test('a tab has no border box: the underline marks it, the ring is for the keyboard', () => {
    const tabs = inspectorCss.slice(inspectorCss.indexOf('.sf-itabs {'), inspectorCss.indexOf('// ── Sections'));
    expect(tabs).toMatch(/\.components-button\.sf-itabs__tab \{[^}]*border: 0;[^}]*outline: none;/s);
    expect(tabs).toContain('&:focus:not(:focus-visible)');
    expect(tabs).toMatch(/&\.is-active,[^{]*\{\s+color: var\(--sf-text\);\s+box-shadow: inset 0 -2px 0 var\(--sf-brand\);/);
    expect(tabs).toMatch(/&:focus-visible \{\s+outline: \$sf-focus;/);
  });

  test('the scroll element reserves its scrollbar and the header, tabs and footer sit outside it', () => {
    expect(inspectorCss).toMatch(/&__scroll \{[^}]*scrollbar-gutter: stable;/s);
    expect(inspectorCss).toMatch(/@supports not \(scrollbar-gutter: stable\) \{\s+overflow-y: scroll;/);
    expect(formEditorCss).toMatch(/&__inspector \{[^}]*overflow: hidden;/s);
    const h = mountInspector('text');
    const root = h.container.querySelector('.sf-field-inspector');
    const scroll = root.querySelector('.sf-field-inspector__scroll');
    expect(scroll.querySelector('.sf-field-inspector__header')).toBeNull();
    expect(scroll.querySelector('[role="tablist"]')).toBeNull();
    expect(scroll.querySelector('.sf-field-inspector__footer')).toBeNull();
    expect(scroll.querySelector('.sf-field-inspector__sheet')).not.toBeNull();
    expect(root.querySelector(':scope > .sf-field-inspector__footer')).not.toBeNull();
    h.unmount();
  });
});
