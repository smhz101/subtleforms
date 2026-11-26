/**
 * Phone caret (#200): a mid-number edit keeps the caret after the typed digit.
 */
import { createRoot, useState } from '@wordpress/element';
import { act } from 'react';
import UsPhoneInput from './UsPhoneInput';
import PhoneField from './PhoneField';

global.IS_REACT_ACT_ENVIRONMENT = true;

function mount(node) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(node));
  return { input: container.querySelector('input[type="tel"]'), done: () => { act(() => root.unmount()); container.remove(); } };
}

function type(input, text, caret) {
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, text);
    input.setSelectionRange(caret, caret);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function PlainUs() {
  const [value, setValue] = useState('(555) 010-1234');
  return <UsPhoneInput type="tel" value={value} onChange={setValue} />;
}

function WithCountry({ config, initial }) {
  const [value, setValue] = useState(initial);
  return <PhoneField config={config} value={value} onChange={setValue} />;
}

describe('plain US phone input', () => {
  test('inserting a digit mid-number keeps the caret after it', () => {
    const { input, done } = mount(<PlainUs />);
    type(input, '(5559) 010-1234', 5);
    expect(input.value).toBe('(555) 901-0123');
    expect(input.selectionStart).toBe(7);
    done();
  });

  test('backspace over a bracket deletes the digit before it', () => {
    const { input, done } = mount(<PlainUs />);
    type(input, '(555 010-1234', 4);
    expect(input.value).toBe('(550) 101-234');
    expect(input.selectionStart).toBe(3);
    done();
  });
});

describe('phone field with country selector', () => {
  test('stores digits only, caret is counted on the formatted text shown', () => {
    const { input, done } = mount(
      <WithCountry config={{ format: 'us', inputMask: 'phone', maskStore: 'digits' }} initial="+1 5550101234" />
    );
    expect(input.value).toBe('(555) 010-1234');
    type(input, '(5559) 010-1234', 5);
    expect(input.value).toBe('(555) 901-0123');
    expect(input.selectionStart).toBe(7);
    done();
  });
});

describe('FieldRenderer plain US phone', () => {
  const FieldRenderer = require('../FieldRenderer').default;
  const { loadAllFieldGroups } = require('./lazyFields');

  function Host({ field }) {
    const [values, setValues] = useState({ ph: '' });
    return <FieldRenderer field={field} values={values} onChange={(_k, v) => setValues({ ph: v })} errors={{}} />;
  }

  test.each([
    ['flat format', { type: 'phone', key: 'ph', label: 'Phone', format: 'us' }],
    ['config.format', { type: 'phone', key: 'ph', label: 'Phone', config: { format: 'us' } }],
  ])('formats while typing (%s)', async (_n, field) => {
    await loadAllFieldGroups();
    const { input, done } = mount(<Host field={field} />);
    type(input, '5550101234', 10);
    expect(input.value).toBe('(555) 010-1234');
    expect(input.getAttribute('inputmode')).toBe('tel');
    done();
  });
});
