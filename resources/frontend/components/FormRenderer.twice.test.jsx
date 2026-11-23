/**
 * Free #135: the same form twice on one page must not share element ids.
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';
import FormRenderer from './FormRenderer';

global.IS_REACT_ACT_ENVIRONMENT = true;

const schema = {
  metadata: {},
  fields: [
    { id: 'a', key: 'name', type: 'text', label: 'Name', description: 'Your full name', required: true },
    { id: 'b', key: 'email', type: 'email', label: 'Email' },
    {
      id: 'c',
      key: 'topic',
      type: 'radio',
      label: 'Topic',
      options: [{ label: 'One', value: 'one' }, { label: 'Two', value: 'two' }],
    },
    { id: 'd', key: 'agree', type: 'checkbox', label: 'Agree' },
  ],
};

const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 50)); });

function mountForm(formId = 77) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  return {
    container,
    root,
    async render() {
      await act(async () => {
        root.render(<FormRenderer preloadedSchema={schema} formId={formId} />);
      });
      await settle();
    },
    unmount() {
      act(() => root.unmount());
      container.remove();
    },
  };
}

const idsIn = (el) => [...el.querySelectorAll('[id]')].map((n) => n.id);
const fieldIds = (el) => idsIn(el).filter((id) => id.startsWith('subtleforms-field-'));

describe('the same form twice on a page (#135)', () => {
  let first;
  let second;

  beforeEach(async () => {
    first = mountForm();
    second = mountForm();
    await first.render();
    await second.render();
  });

  afterEach(() => {
    second.unmount();
    first.unmount();
  });

  it('gives every element in the document its own id', () => {
    const all = [...document.querySelectorAll('[id]')].map((n) => n.id);
    const dupes = all.filter((id, i) => all.indexOf(id) !== i);
    expect(dupes).toEqual([]);
  });

  it('keeps today\'s ids for the first copy', () => {
    const ids = fieldIds(first.container);
    expect(ids).toEqual(expect.arrayContaining([
      'subtleforms-field-name',
      'subtleforms-field-name-label',
      'subtleforms-field-name-help',
      'subtleforms-field-email',
      'subtleforms-field-topic-label',
      'subtleforms-field-topic-0',
      'subtleforms-field-agree',
    ]));
    expect(ids.some((id) => /^subtleforms-field-\d+-/.test(id))).toBe(false);
  });

  it('numbers the second copy', () => {
    const ids = fieldIds(second.container);
    expect(ids).toEqual(expect.arrayContaining([
      'subtleforms-field-2-name',
      'subtleforms-field-2-name-label',
      'subtleforms-field-2-email',
      'subtleforms-field-2-agree',
    ]));
    expect(ids).not.toContain('subtleforms-field-name');
  });

  it('points every label and aria reference at an element in the same form', () => {
    for (const { container } of [first, second]) {
      const root = container.querySelector('form') || container;
      const refs = [];
      root.querySelectorAll('label[for]').forEach((n) => refs.push(n.getAttribute('for')));
      root.querySelectorAll('[aria-labelledby], [aria-describedby]').forEach((n) => {
        ['aria-labelledby', 'aria-describedby'].forEach((attr) => {
          (n.getAttribute(attr) || '').split(/\s+/).filter(Boolean).forEach((id) => refs.push(id));
        });
      });
      expect(refs.length).toBeGreaterThan(0);
      refs.forEach((id) => {
        expect(root.querySelector(`[id="${id}"]`)).not.toBeNull();
      });
    }
  });

  it('hands the number back when a copy unmounts', async () => {
    second.unmount();
    second = mountForm();
    await second.render();
    expect(fieldIds(second.container)).toContain('subtleforms-field-2-name');
  });

  it('keeps copy 1 ids in Preview even while another copy is live', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(<FormRenderer preloadedSchema={schema} formId={77} preview />);
    });
    await settle();
    expect(fieldIds(container)).toContain('subtleforms-field-name');
    act(() => root.unmount());
    container.remove();
  });

  it('gives a copy swapped for a fresh mount of the same form the plain ids again', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const render = (key) => act(async () => {
      root.render(<FormRenderer key={key} preloadedSchema={schema} formId={88} />);
    });
    await render('one');
    await settle();
    expect(fieldIds(container)).toContain('subtleforms-field-name');
    await render('two');
    await settle();
    const ids = fieldIds(container);
    expect(ids).toContain('subtleforms-field-name');
    expect(ids.some((id) => /^subtleforms-field-\d+-/.test(id))).toBe(false);
    act(() => root.unmount());
    container.remove();
  });
});
