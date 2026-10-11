/**
 * The public field renderer, rendered in jsdom for every field type at
 * every width (2.2.1 bug 1), plus the per-field fixes of 2.2.1.
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';
import FieldRenderer, { hasVisibleText } from './FieldRenderer';
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
    test.each(SAMPLES.map((s) => [s.key || s.type, s]))('%s keeps required, options, placeholder and help', (_, sample) => {
      const field = buildField(sample, width, shape);
      const { container, unmount } = render(field);
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
        expect(container.querySelector('[aria-required="true"], [required]')).not.toBeNull();
      }
      expect(container.querySelector(`#${id}-help`).textContent).toBe(`Help for ${field.key}`);

      const control = container.querySelector(`#${id}`);
      if (sample.check.native) {
        expect(control.required).toBe(true);
      }
      if (sample.check.placeholder) {
        if (control.tagName === 'SELECT') {
          expect(control.options[0].textContent).toBe(sample.extra.placeholder);
        } else {
          expect(control.getAttribute('placeholder')).toBe(sample.extra.placeholder);
        }
      }
      if (sample.check.options) {
        if (control && control.tagName === 'SELECT') {
          expect(control.options).toHaveLength(sample.check.options + 1);
        } else {
          expect(wrapper.querySelectorAll('input[type="radio"], input[type="checkbox"]')).toHaveLength(sample.check.options);
        }
      }
      if (sample.check.countries) {
        expect(control.options.length).toBeGreaterThan(240);
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

  test('empty matrix, calculation without formula and empty disclaimer are not drawn (bugs 8, 9, 10)', () => {
    for (const field of [
      { key: 'g', type: 'checkbox_grid', label: 'Grid', rows: [], columns: [] },
      { key: 'c', type: 'calculation', label: 'Total', formula: '' },
      { key: 'd', type: 'disclaimer', content: '<p> </p>' },
    ]) {
      const { container, unmount } = render(field);
      expect(container.innerHTML).toBe('');
      unmount();
    }
    expect(hasVisibleText('<p>&nbsp;</p>')).toBe(false);
    expect(hasVisibleText('<p>Terms apply</p>')).toBe(true);
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

  test('a server error is shown on the field and described (bug 2)', () => {
    const field = { key: 'email', type: 'email', label: 'Email', required: true };
    const { container, unmount } = render(field, { errors: { email: 'Invalid email address.' } });
    const input = container.querySelector('#subtleforms-field-email');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toContain('subtleforms-field-email-error');
    expect(container.querySelector('#subtleforms-field-email-error').textContent).toBe('Invalid email address.');
    unmount();
  });
});
