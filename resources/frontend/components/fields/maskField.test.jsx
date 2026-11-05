/**
 * Input mask (2.8.0): the field as the visitor meets it, the lazy group it
 * loads from, and the validation the form runs.
 */
import { createRoot, useState } from '@wordpress/element';
import { act } from 'react';
import { MaskedInput, maskError, maskHint } from './maskField';
import { fieldGroups, fieldHasMask, loadAllFieldGroups, FIELD_GROUPS } from './lazyFields';
import { validateField } from '../../utils/fieldValidation';
import FieldRenderer from '../FieldRenderer';
import { resolveMask } from '../../../shared/inputMask';

global.IS_REACT_ACT_ENVIRONMENT = true;

function mount(element) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(element));
  return { container, unmount: () => act(() => root.unmount()) };
}

function type(input, text, caret = text.length) {
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, text);
    input.setSelectionRange(caret, caret);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function Harness({ config, start = '', onValue }) {
  const [value, setValue] = useState(start);
  return (
    <MaskedInput
      id="f"
      config={config}
      value={value}
      describedBy="f-help"
      onChange={(next) => {
        setValue(next);
        onValue?.(next);
      }}
    />
  );
}

beforeAll(() => loadAllFieldGroups());

describe('MaskedInput', () => {
  it('formats while typing and shows the format as placeholder and hint', () => {
    const seen = [];
    const { container } = mount(<Harness config={{ inputMask: 'date_dmy' }} onValue={(v) => seen.push(v)} />);
    const input = container.querySelector('input');
    expect(input.placeholder).toBe('DD/MM/YYYY');
    expect(input.getAttribute('inputmode')).toBe('numeric');
    const hint = container.querySelector('.subtleforms-mask-hint');
    expect(hint.textContent).toBe('Format: DD/MM/YYYY');
    expect(input.getAttribute('aria-describedby')).toBe(`f-help ${hint.id}`);
    type(input, '3');
    type(input, '31');
    type(input, '311');
    expect(input.value).toBe('31/1');
    type(input, '31/12202699');
    expect(input.value).toBe('31/12/2026');
    expect(seen[seen.length - 1]).toBe('31/12/2026');
  });

  it('keeps the field placeholder when it has one', () => {
    const { container } = mount(
      <MaskedInput id="f" config={{ inputMask: 'zip_us' }} value="" onChange={() => {}} placeholder="Your ZIP" />
    );
    expect(container.querySelector('input').placeholder).toBe('Your ZIP');
  });

  it('formats a paste or autofill in one go', () => {
    const { container } = mount(<Harness config={{ inputMask: 'custom', maskPattern: '999-999-9999' }} />);
    const input = container.querySelector('input');
    type(input, '(555) 010-1234');
    expect(input.value).toBe('555-010-1234');
  });

  it('puts the caret back after a backspace over a literal', async () => {
    const { container } = mount(<Harness config={{ inputMask: 'custom', maskPattern: '99-99' }} start="12-34" />);
    const input = container.querySelector('input');
    input.focus();
    // Backspace with the caret after the dash removes the dash.
    type(input, '1234', 2);
    await act(async () => {});
    expect(input.value).toBe('12-34');
    expect(input.selectionStart).toBe(2);
  });

  it('saves digits only but shows the mask', () => {
    const seen = [];
    const { container } = mount(
      <Harness config={{ inputMask: 'custom', maskPattern: '999-99', maskStore: 'digits' }} onValue={(v) => seen.push(v)} />
    );
    const input = container.querySelector('input');
    type(input, '12345');
    expect(input.value).toBe('123-45');
    expect(seen[seen.length - 1]).toBe('12345');
  });

  it('uses the phone keyboard for phone masks and does not force a pattern', () => {
    const { container } = mount(<Harness config={{ inputMask: 'phone' }} />);
    const input = container.querySelector('input');
    expect(input.getAttribute('inputmode')).toBe('tel');
    type(input, '+44 (20) 7946 abc');
    expect(input.value).toBe('+44 (20) 7946 ');
    expect(container.querySelector('.subtleforms-mask-hint').textContent).toMatch(/15 digits/);
  });

  it('explains custom symbols in the hint', () => {
    expect(maskHint(resolveMask({ inputMask: 'custom', maskPattern: 'AA-9999' }))).toBe(
      'Format: AA-9999 (A is a letter, 9 is a digit)'
    );
    expect(maskHint(resolveMask({ inputMask: 'zip_us' }))).toBe('Format: 12345 or 12345-6789');
  });
});

describe('mask errors and validation', () => {
  it('names the format in the message', () => {
    expect(maskError({ inputMask: 'date_dmy' }, '31/12/26')).toBe('Enter the date as DD/MM/YYYY.');
    expect(maskError({ inputMask: 'date_dmy' }, '31/02/2026')).toBe('That date does not exist. Enter the date as DD/MM/YYYY.');
    expect(maskError({ inputMask: 'time_24' }, '25:00')).toBe('Enter the time as HH:MM (24-hour).');
    expect(maskError({ inputMask: 'custom', maskPattern: 'AA-9999' }, 'ab-12')).toBe('Enter this in the format AA-9999.');
    expect(maskError({ inputMask: 'date_dmy' }, '31/12/2026')).toBe('');
  });

  it('lets an empty optional field pass and fails a required one', () => {
    const field = { type: 'text', key: 'd', inputMask: 'date_dmy' };
    expect(validateField(field, '')).toBeUndefined();
    expect(validateField({ ...field, required: true }, '')).toBe('This field is required.');
    expect(validateField(field, '31/02/2026')).toMatch(/does not exist/);
    expect(validateField(field, '28/02/2026')).toBeUndefined();
  });

  it('does not treat a masked number as a bad number', () => {
    const field = { type: 'number', key: 'n', inputMask: 'custom', maskPattern: '99-99' };
    expect(validateField(field, '12-34')).toBeUndefined();
    expect(validateField(field, '12-3')).toBe('Enter this in the format 99-99.');
    expect(validateField({ ...field, inputMask: '' }, '12-34')).toBe('Please enter a number.');
  });

  it('uses the custom validation message when the field has one', () => {
    const field = { type: 'text', key: 'd', inputMask: 'date_dmy', validationMessage: 'Use the date format.' };
    expect(validateField(field, '1/1')).toBe('Use the date format.');
  });
});

describe('lazy group', () => {
  it('is asked for only by fields that have a mask', () => {
    const schema = (fields) => ({ fields });
    expect([...fieldGroups(schema([{ type: 'text', key: 'a' }]))]).toEqual([]);
    expect([...fieldGroups(schema([{ type: 'text', key: 'a', inputMask: '' }]))]).toEqual([]);
    expect([...fieldGroups(schema([{ type: 'text', key: 'a', inputMask: 'zip_us' }]))]).toEqual(['mask']);
    expect([...fieldGroups(schema([{ type: 'number', key: 'a', config: { inputMask: 'custom' } }]))]).toEqual(['mask']);
    expect([...fieldGroups(schema([{ type: 'step', children: [{ type: 'phone', key: 'p', inputMask: 'phone' }] }]))]).toEqual(['mask']);
    // The country picker handles the phone mask itself.
    expect([...fieldGroups(schema([{ type: 'phone', key: 'p', inputMask: 'phone', enableCountryCode: true }]))]).toEqual(['geo']);
    // Other types ignore the setting.
    expect(fieldHasMask({ type: 'email', inputMask: 'phone' })).toBe(false);
    expect(FIELD_GROUPS).toContain('mask');
  });
});

describe('FieldRenderer', () => {
  it('draws a masked text field with its hint', async () => {
    const values = { code: '' };
    const { container } = mount(
      <FieldRenderer
        field={{ type: 'text', key: 'code', label: 'Code', inputMask: 'custom', maskPattern: 'AA-9999', description: 'Your code' }}
        values={values}
        onChange={() => {}}
        errors={{}}
        hiddenFields={new Set()}
      />
    );
    const input = container.querySelector('input');
    expect(input.placeholder).toBe('AA-9999');
    const describedBy = input.getAttribute('aria-describedby').split(' ');
    expect(describedBy).toContain('subtleforms-field-code-help');
    expect(describedBy).toContain('subtleforms-field-code-mask');
    expect(container.querySelector('#subtleforms-field-code-mask').textContent).toMatch(/^Format: AA-9999/);
  });
});
