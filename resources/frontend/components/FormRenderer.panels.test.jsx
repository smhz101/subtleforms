/**
 * Tabs and Accordion in a form (2.9.0): a required field in a closed panel is
 * opened and focused after submit, and a hidden panel is not checked.
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';
import FormRenderer from './FormRenderer';

global.IS_REACT_ACT_ENVIRONMENT = true;

const wait = (ms = 80) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });

const text = (key, extra = {}) => ({ id: `n_${key}`, key, type: 'text', label: key, ...extra });
const tab = (key, children, extra = {}) => ({ id: `p_${key}`, key, type: 'tab_panel', label: key, children, ...extra });
const sec = (key, children, extra = {}) => ({ id: `s_${key}`, key, type: 'accordion_panel', label: key, children, ...extra });

const tabs = (panels, extra = {}) => ({
  id: 'tabs1', key: 'tabs1', type: 'tabs_container', label: 'Tabs', position: 'top', collapse_mobile: true, active: 0, children: panels, ...extra,
});
const accordion = (panels, extra = {}) => ({
  id: 'acc1', key: 'acc1', type: 'accordion_container', label: 'Acc', multiple: false, open: 'first', icon: 'chevron', children: panels, ...extra,
});

let root;
let container;

async function mount(fields) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(<FormRenderer formId={7} preloadedSchema={{ metadata: {}, fields }} />);
  });
  await wait();
}

const submit = async () => {
  await act(async () => container.querySelector('button[type="submit"]').click());
  await wait(120);
};

const type = async (name, value) => {
  const input = container.querySelector(`input[name="${name}"]`);
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  await act(async () => {
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

beforeEach(() => {
  delete window.matchMedia;
  global.fetch = jest.fn(async () => ({ status: 404, ok: false, json: async () => ({}), clone() { return this; } }));
});

afterEach(async () => {
  await act(async () => root?.unmount());
  document.body.innerHTML = '';
});

describe('a required field in a closed tab', () => {
  it('opens the tab and takes focus after a submit', async () => {
    await mount([tabs([tab('one', [text('a')]), tab('two', [text('b', { required: true })])])]);
    const input = container.querySelector('input[name="b"]');
    expect(input.closest('[role="tabpanel"]').hidden).toBe(true);
    await submit();
    expect(input.closest('[role="tabpanel"]').hidden).toBe(false);
    expect(document.activeElement).toBe(input);
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const badge = container.querySelectorAll('[role="tab"]')[1].querySelector('.subtleforms-tab-badge');
    expect(badge.textContent).toBe('1');
  });

  it('goes to the first tab with an error, and counts the others', async () => {
    await mount([
      tabs([
        tab('one', [text('a')]),
        tab('two', [text('b', { required: true }), text('c', { required: true })]),
        tab('three', [text('d', { required: true })]),
      ]),
    ]);
    await submit();
    expect(document.activeElement.getAttribute('name')).toBe('b');
    const badges = [...container.querySelectorAll('[role="tab"]')].map((t) => t.querySelector('.subtleforms-tab-badge')?.textContent ?? '');
    expect(badges).toEqual(['', '2', '1']);
  });

  it('clears the badge once the field is fixed', async () => {
    await mount([tabs([tab('one', [text('a')]), tab('two', [text('b', { required: true })])])]);
    await submit();
    await type('b', 'ok');
    expect(container.querySelector('.subtleforms-tab-badge')).toBeNull();
  });
});

describe('a required field in a closed accordion section', () => {
  it('opens the section and takes focus after a submit', async () => {
    await mount([accordion([sec('x', [text('a')]), sec('y', [text('b', { required: true })])])]);
    const input = container.querySelector('input[name="b"]');
    expect(input.closest('[role="region"]').hidden).toBe(true);
    await submit();
    expect(input.closest('[role="region"]').hidden).toBe(false);
    expect(document.activeElement).toBe(input);
  });

  it('opens every closed panel around a field nested in tabs inside a section', async () => {
    const inner = tabs([tab('i1', [text('a')]), tab('i2', [text('deep', { required: true })])], { id: 'inner', key: 'inner' });
    await mount([accordion([sec('x', [text('z')]), sec('y', [inner])])]);
    await submit();
    expect(document.activeElement.getAttribute('name')).toBe('deep');
  });
});

describe('a panel that logic hides', () => {
  const rule = {
    action: 'show',
    groups: [{ match: 'all', rules: [{ field: 'kind', operator: 'equals', value: 'company' }] }],
  };

  it('is skipped by validation and not drawn', async () => {
    await mount([
      text('kind'),
      tabs([tab('one', [text('a')]), tab('two', [text('company', { required: true })], { logic: rule })]),
    ]);
    expect(container.querySelectorAll('[role="tab"]')).toHaveLength(1);
    await submit();
    // Nothing failed the check, so the form went on to send its answers.
    expect(container.querySelector('[aria-invalid="true"]')).toBeNull();
    expect(global.fetch.mock.calls.some(([url]) => String(url).includes('/submit'))).toBe(true);
  });

  it('is checked once its rule matches', async () => {
    await mount([
      text('kind'),
      tabs([tab('one', [text('a')]), tab('two', [text('company', { required: true })], { logic: rule })]),
    ]);
    await type('kind', 'company');
    expect(container.querySelectorAll('[role="tab"]')).toHaveLength(2);
    await submit();
    expect(document.activeElement.getAttribute('name')).toBe('company');
  });
});
