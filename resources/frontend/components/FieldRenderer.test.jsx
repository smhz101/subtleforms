/**
 * The public field renderer, rendered in jsdom for every field type at
 * every width (2.2.1 bug 1), plus the per-field fixes of 2.2.1.
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';
import FieldRenderer, { hasVisibleText } from './FieldRenderer';
import { registerFieldType } from '../../shared/extend';
import { SAMPLES, WIDTHS, buildField } from '../../../tests/browser/fixtures/fields';

global.IS_REACT_ACT_ENVIRONMENT = true;

function render(field, extra = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <FieldRenderer field={field} values={{}} onChange={() => {}} errors={{}} {...extra} />
    );
  });
  return {
    container,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

beforeAll(() => {
  // jsdom has no canvas; the signature pad only needs a stub.
  HTMLCanvasElement.prototype.getContext = () => ({
    scale() {},
    clearRect() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
  });
});

describe.each(WIDTHS)('width %s', (width) => {
  describe.each(['flat', 'wrapped'])('%s node', (shape) => {
    test.each(SAMPLES.map((s) => [s.key || s.type, s]))('%s keeps required, options, placeholder and help', async (_, sample) => {
      const field = buildField(sample, width, shape);
      const { container, unmount } = render(field);
      // Rich text loads lazily (2.3.0): let it resolve.
      if (sample.type === 'rich_text') {
        for (let i = 0; i < 20 && container.querySelector('.subtleforms-field-loading'); i++) {
          // eslint-disable-next-line no-await-in-loop
          await act(async () => {
            await new Promise((r) => setTimeout(r, 10));
          });
        }
        expect(container.querySelector('.subtleforms-field-loading')).toBeNull();
      }
      const id = `subtleforms-field-${field.key}`;
      const wrapper = container.querySelector('.subtleforms-field');
      expect(wrapper).not.toBeNull();

      if (width === '100') {
        expect(wrapper.style.flexBasis).toBe('');
      } else {
        expect(wrapper.style.flexBasis).toContain(`${width}%`);
      }

      if (!sample.check.noRequired) {
        expect(container.querySelector('.subtleforms-required')).not.toBeNull();
        expect(container.querySelector('[aria-required="true"], [required], [role="group"]')).not.toBeNull();
      }
      expect(container.querySelector(`#${id}-help`).textContent).toBe(`Help for ${field.key}`);

      const control = container.querySelector(`#${id}`);
      if (sample.check.native) {
        expect(control.required).toBe(true);
      }
      if (sample.check.picker) {
        expect(control.tagName).toBe('BUTTON');
        // aria-required is not allowed on a button. The fallback control carries required.
        expect(wrapper.querySelector('select[required], input[required]')).not.toBeNull();
      }
      if (sample.check.placeholder) {
        if (control.tagName === 'SELECT') {
          expect(control.options[0].textContent).toBe(sample.extra.placeholder);
        } else if (control.tagName === 'BUTTON') {
          expect(control.textContent).toContain(sample.extra.placeholder);
        } else {
          expect(control.getAttribute('placeholder')).toBe(sample.extra.placeholder);
        }
      }
      if (sample.check.options) {
        const select = control && control.tagName === 'SELECT' ? control : wrapper.querySelector('select');
        if (select) {
          expect(select.options).toHaveLength(sample.check.options + 1);
        } else {
          expect(wrapper.querySelectorAll('input[type="radio"], input[type="checkbox"]')).toHaveLength(sample.check.options);
        }
      }
      if (sample.check.countries) {
        const select = control && control.tagName === 'SELECT' ? control : wrapper.querySelector('select');
        expect(select.options.length).toBeGreaterThan(240);
      }

      // Every control is named (bug 11).
      const unnamed = Array.from(wrapper.querySelectorAll('input, select, textarea')).filter(
        (c) => c.type !== 'button' && !c.name
      );
      expect(unnamed).toHaveLength(0);
      unmount();
    });
  });
});

describe('2.2.1 field fixes', () => {
  test('a single checkbox saved with options renders as a checkbox group (bug 7)', () => {
    const { container, unmount } = render({
      key: 'extras',
      type: 'checkbox',
      label: 'Extras',
      options: [
        { label: 'Gift wrap', value: 'gift' },
        { label: 'Card', value: 'card' },
        { label: 'Bow', value: 'bow' },
      ],
    });
    const boxes = container.querySelectorAll('input[type="checkbox"]');
    expect(boxes).toHaveLength(3);
    expect(boxes[0].name).toBe('extras[]');
    expect(container.textContent).not.toContain('I agree');
    unmount();
  });

  test('dropdown and consent carry a name (bug 11)', () => {
    let r = render({ key: 'topic', type: 'dropdown', label: 'Topic', options: [{ label: 'A', value: 'a' }] });
    expect(r.container.querySelector('select').name).toBe('topic');
    r.unmount();
    r = render({ key: 'agree', type: 'consent', label: 'Consent' });
    expect(r.container.querySelector('input[type="checkbox"]').name).toBe('agree');
    r.unmount();
  });

  test('empty matrix, an add-on field with nothing to show and empty disclaimer are not drawn (bugs 8, 9, 10)', () => {
    registerFieldType('qa_total', {
      component: () => <output>total</output>,
      isAnswerable: (config) => !!String(config.formula || '').trim(),
    });
    for (const field of [
      { key: 'g', type: 'checkbox_grid', label: 'Grid', rows: [], columns: [] },
      { key: 'c', type: 'qa_total', label: 'Total', formula: '' },
      { key: 'd', type: 'disclaimer', content: '<p> </p>' },
    ]) {
      const { container, unmount } = render(field);
      expect(container.innerHTML).toBe('');
      unmount();
    }
    expect(hasVisibleText('<p>&nbsp;</p>')).toBe(false);
    expect(hasVisibleText('<p>Terms apply</p>')).toBe(true);
  });

  test('a field type no plugin provides is left out of the live form (2.3.9)', () => {
    const { container, unmount } = render({ key: 'sig', type: 'signature', label: 'Signature' });
    expect(container.textContent).not.toContain('not supported');
    expect(container.querySelector('input, canvas, output')).toBeNull();
    unmount();
  });

  test('a disclaimer with text is drawn', () => {
    const { container, unmount } = render({ key: 'd', type: 'disclaimer', content: '<p>Terms apply</p>' });
    expect(container.querySelector('.subtleforms-disclaimer').textContent).toContain('Terms apply');
    unmount();
  });

  test('the standalone Country field lists every country without a stored copy (bug 3)', () => {
    const { container, unmount } = render({ key: 'country', type: 'country', label: 'Country', output_format: 'name', preferred_countries: ['PK'] });
    const select = container.querySelector('select');
    expect(select.options.length).toBe(250);
    expect(select.options[1].value).toBe('Pakistan');
    unmount();
  });

  test('name and address groups are labelled groups, not legends', () => {
    for (const field of [
      { key: 'name', type: 'name_group', label: 'Name', required: true },
      { key: 'addr', type: 'address_group', label: 'Address', required: true },
      { key: 'address', type: 'address', label: 'Address', required: true },
    ]) {
      const { container, unmount } = render(field);
      expect(container.querySelector('legend')).toBeNull();
      const group = container.querySelector('[role="group"]');
      const label = container.querySelector('.subtleforms-field-label');
      expect(group).not.toBeNull();
      expect(group.getAttribute('aria-labelledby')).toBe(label.id);
      expect(container.querySelector('.subtleforms-required')).not.toBeNull();
      unmount();
    }
  });

  test('a toggle is unchecked for off-like values and checked for yes', () => {
    let view = render({ key: 't', type: 'toggle', label: 'Toggle' });
    expect(view.container.querySelector('input[type="checkbox"]').checked).toBe(false);
    view.unmount();
    for (const value of [0, '0', 'off', 'no']) {
      view = render({ key: 't', type: 'toggle', label: 'Toggle' }, { values: { t: value } });
      expect(view.container.querySelector('input[type="checkbox"]').checked).toBe(false);
      view.unmount();
    }
    view = render({ key: 't', type: 'toggle', label: 'Toggle' }, { values: { t: 'yes' } });
    expect(view.container.querySelector('input[type="checkbox"]').checked).toBe(true);
    view.unmount();
  });

  test('a chained select renders a dropdown for each level', () => {
    const { container, unmount } = render({
      key: 'place',
      type: 'chained_select',
      label: 'Place',
      levels: [
        { label: 'Country', options: [{ label: 'United States', value: 'us' }] },
        { label: 'State', options: [{ label: 'California', value: 'ca' }] },
      ],
    });
    expect(container.querySelectorAll('select').length).toBeGreaterThan(1);
    unmount();
  });

  test('buttons and columns render choices instead of menus', () => {
    const field = {
      key: 'place',
      type: 'chained_select',
      label: 'Place',
      presentation: 'buttons',
      levels: [
        {
          label: 'Country',
          options: [
            { label: 'Pakistan', value: 'pakistan' },
            { label: 'USA', value: 'usa' },
          ],
        },
        {
          label: 'State',
          options: [
            { label: 'Punjab', value: 'punjab', parent: 'pakistan' },
            { label: 'California', value: 'california', parent: 'usa' },
          ],
        },
      ],
    };
    const buttons = render(field);
    expect(buttons.container.querySelector('select')).toBeNull();
    expect(buttons.container.querySelector('[role="radio"]')).not.toBeNull();
    expect(buttons.container.querySelector('[aria-pressed]')).toBeNull();
    expect(buttons.container.textContent).toContain('Pakistan');
    expect(buttons.container.textContent).not.toContain('Punjab');
    buttons.unmount();

    const chosen = render(field, { values: { place: ['pakistan'] } });
    expect(chosen.container.textContent).toContain('Punjab');
    expect(chosen.container.textContent).not.toContain('California');
    chosen.unmount();

    const columns = render({ ...field, presentation: 'columns' }, { values: { place: ['pakistan'] } });
    expect(columns.container.querySelector('.is-columns')).not.toBeNull();
    expect(columns.container.textContent).toContain('Punjab');
    columns.unmount();

    const open = render({
      ...field,
      presentation: 'columns',
      levels: [
        ...field.levels,
        { label: 'City', options: [{ label: 'Lahore', value: 'lahore', parent: 'punjab' }] },
      ],
    });
    expect(open.container.textContent).toContain('Punjab');
    expect(open.container.textContent).not.toContain('California');
    expect(open.container.textContent).not.toContain('Lahore');
    expect(open.container.querySelectorAll('.subtleforms-chained-select__level')).toHaveLength(3);
    expect(open.container.querySelector('.is-inactive')).not.toBeNull();
    open.unmount();
  });

  test('a server error is shown on the field and described (bug 2)', () => {
    const field = { key: 'email', type: 'email', label: 'Email', required: true };
    const { container, unmount } = render(field, { errors: { email: 'Invalid email address.' } });
    const input = container.querySelector('#subtleforms-field-email');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toContain('subtleforms-field-email-error');
    expect(container.querySelector('#subtleforms-field-email-error').textContent).toBe('Invalid email address.');
    unmount();
  });

  test('a hidden field sends its value without showing a label', () => {
    const { container, unmount } = render(
      { key: 'utm_source', type: 'hidden', label: 'Source', value: 'newsletter' },
      { values: { utm_source: 'newsletter' } }
    );
    const input = container.querySelector('input[type="hidden"]');
    expect(input).not.toBeNull();
    expect(input.name).toBe('utm_source');
    expect(input.value).toBe('newsletter');
    expect(container.querySelector('.subtleforms-field-label')).toBeNull();
    expect(container.textContent).not.toContain('Source');
    unmount();
  });
});

describe('2.3.2: label visibility, help text placement and container labels', () => {
  const { FormContext } = require('./fields/FileUpload');

  function renderWith(field, fieldDefaults) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(
        <FormContext.Provider value={{ formId: 1, preview: false, fieldDefaults }}>
          <FieldRenderer field={field} values={{}} onChange={() => {}} errors={{}} />
        </FormContext.Provider>
      );
    });
    return { container, unmount: () => { act(() => root.unmount()); container.remove(); } };
  }

  test('a hidden label stays in the page and still names the input', () => {
    const { container, unmount } = renderWith({ key: 'name', type: 'text', label: 'Name', labelVisibility: 'hidden' });
    const wrapper = container.querySelector('.subtleforms-field');
    expect(wrapper.className).toContain('subtleforms-field--no-label');
    const label = container.querySelector('label.subtleforms-field-label');
    expect(label.textContent).toBe('Name');
    expect(label.getAttribute('for')).toBe(container.querySelector('input').id);
    unmount();
  });

  test('help text above the input, and the form default applies', () => {
    const { container, unmount } = renderWith(
      { key: 'e', type: 'email', label: 'Email', description: 'We reply here' },
      { labelVisibility: 'visible', descriptionPlacement: 'above' }
    );
    const help = container.querySelector('.subtleforms-field-help');
    const input = container.querySelector('input');
    expect(help.textContent).toBe('We reply here');
    expect(help.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(input.getAttribute('aria-describedby')).toContain(help.id);
    unmount();
  });

  test('a field setting wins over the form default', () => {
    const { container, unmount } = renderWith(
      { key: 'a', type: 'text', label: 'A', labelVisibility: 'visible', descriptionPlacement: 'below', description: 'Help' },
      { labelVisibility: 'hidden', descriptionPlacement: 'above' }
    );
    expect(container.querySelector('.subtleforms-field').className).not.toContain('subtleforms-field--no-label');
    const help = container.querySelector('.subtleforms-field-help');
    expect(container.querySelector('input').compareDocumentPosition(help) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    unmount();
  });

  test('Group and Columns show their label and help text', () => {
    const group = renderWith({
      key: 'g', type: 'group_container', label: 'Where you live', description: 'Your home city.',
      children: [{ key: 'city', type: 'text', label: 'City' }],
    });
    expect(group.container.querySelector('.subtleforms-container-label').textContent).toBe('Where you live');
    expect(group.container.querySelector('.subtleforms-container-help').textContent).toBe('Your home city.');
    group.unmount();

    const cols = renderWith({
      key: 'c', type: 'two_column_container', label: 'Your name', description: 'As on your passport.',
      columns: [[{ key: 'first', type: 'text', label: 'First' }], [{ key: 'last', type: 'text', label: 'Last' }]],
    });
    expect(cols.container.querySelector('.subtleforms-container-label').textContent).toBe('Your name');
    expect(cols.container.querySelectorAll('input')).toHaveLength(2);
    cols.unmount();
  });
});
