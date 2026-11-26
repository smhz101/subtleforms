/**
 * Password field (2.11.0): coloured strength bar and the rules checklist.
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';
import FieldRenderer from './FieldRenderer';
import { loadAllFieldGroups } from './fields/lazyFields';

global.IS_REACT_ACT_ENVIRONMENT = true;

beforeAll(() => loadAllFieldGroups());

function render(config, value) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const field = { type: 'password', key: 'pw', label: 'Password', ...config };
  act(() => {
    root.render(<FieldRenderer field={field} values={{ pw: value }} onChange={() => {}} errors={{}} />);
  });
  return { container, done: () => { act(() => root.unmount()); container.remove(); } };
}

describe('password strength bar', () => {
  test.each([
    ['', 'none', 0, ''],
    ['abc', 'weak', 1, 'Weak'],
    ['Abcdefgh', 'fair', 2, 'Fair'],
    ['Abcdefg1', 'good', 3, 'Good'],
    ['Abcdef1!', 'strong', 4, 'Strong'],
  ])('%j is %s', (value, level, filled, text) => {
    const { container, done } = render({ minLength: 8, strengthMeter: true }, value);
    const meter = container.querySelector('.subtleforms-password__meter');
    expect(meter.classList.contains(`is-${level}`)).toBe(true);
    expect(meter.querySelectorAll('.subtleforms-password__bar > span')).toHaveLength(4);
    const label = container.querySelector('.subtleforms-password__level');
    expect(label.getAttribute('role')).toBe('status');
    expect(label.querySelector('[aria-hidden]')?.textContent ?? '').toBe(text);
    // The CSS fills the first N segments from the level class.
    expect(['none', 'weak', 'fair', 'good', 'strong'].indexOf(level)).toBe(filled);
    done();
  });

  test('no bar when the meter is off', () => {
    const { container, done } = render({ strengthMeter: false }, 'abc');
    expect(container.querySelector('.subtleforms-password__meter')).toBeNull();
    done();
  });
});

describe('password rules checklist', () => {
  test('hidden for a default field', () => {
    const { container, done } = render({ minLength: 8, strengthMeter: true }, 'abc');
    expect(container.querySelector('.subtleforms-password__rules')).toBeNull();
    done();
  });

  test('items toggle met as the value changes', () => {
    const config = { minLength: 8, requireUppercase: true, requireNumber: true, minStrength: 'good' };
    const weak = render(config, 'abcdefgh');
    const items = [...weak.container.querySelectorAll('.subtleforms-password__rules li')];
    expect(items.map((li) => li.textContent)).toEqual([
      expect.stringContaining('At least 8 characters'),
      expect.stringContaining('An uppercase letter'),
      expect.stringContaining('A number'),
      expect.stringContaining('Strength: Good or better'),
    ]);
    expect(items.map((li) => li.classList.contains('is-met'))).toEqual([true, false, false, false]);
    weak.done();

    const strong = render(config, 'Abcdefg1');
    const met = [...strong.container.querySelectorAll('.subtleforms-password__rules li')];
    expect(met.every((li) => li.classList.contains('is-met'))).toBe(true);
    strong.done();
  });
});

describe('password confirmation (issue 190)', () => {
  function renderWith(field, values, errors = {}) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(<FieldRenderer field={field} values={values} onChange={() => {}} errors={errors} />);
    });
    return { container, done: () => { act(() => root.unmount()); container.remove(); } };
  }

  test.each([
    ['flat', { requireConfirmation: true }],
    ['under config', { config: { requireConfirmation: true } }],
  ])('the confirm input shows when the setting is saved %s', (_label, extra) => {
    const { container, done } = renderWith({ type: 'password', key: 'pw', label: 'Password', ...extra }, { pw: 'abc' });
    expect(container.querySelector('.subtleforms-password__confirm')).not.toBeNull();
    done();
  });

  test('the confirm input is marked invalid after the mismatch error, even when empty', () => {
    const field = { type: 'password', key: 'pw', label: 'Password', requireConfirmation: true };
    const { container, done } = renderWith(field, { pw: 'abc' }, { pw: 'The passwords do not match.' });
    expect(container.querySelector('.subtleforms-password__confirm').getAttribute('aria-invalid')).toBe('true');
    done();
  });

  test('the confirm input is not marked invalid before any error', () => {
    const field = { type: 'password', key: 'pw', label: 'Password', requireConfirmation: true };
    const { container, done } = renderWith(field, { pw: 'abc' });
    expect(container.querySelector('.subtleforms-password__confirm').getAttribute('aria-invalid')).toBeNull();
    done();
  });
});

describe('password confirmation shown while typing', () => {
  const field = { type: 'password', key: 'pw', label: 'Password', requireConfirmation: true };
  function renderWith(values, errors = {}) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(<FieldRenderer field={field} values={values} onChange={() => {}} errors={errors} />);
    });
    return { container, done: () => { act(() => root.unmount()); container.remove(); } };
  }
  const live = (c) => c.querySelector('.subtleforms-password__mismatch');

  test.each([
    ['a wrong character', 'Secret1!', 'Sx'],
    ['the full length but different', 'Secret1!', 'Secret1?'],
    ['longer than the password', 'Secret1!', 'Secret1!x'],
  ])('shows the error under the confirm input for %s', (_l, pw, confirm) => {
    const { container, done } = renderWith({ pw, pw_confirm: confirm });
    const msg = live(container);
    expect(msg).not.toBeNull();
    expect(msg.textContent).toBe('The passwords do not match.');
    const input = container.querySelector('.subtleforms-password__confirm');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe(msg.id);
    expect(msg.previousElementSibling).toBe(input);
    done();
  });

  test.each([
    ['empty', ''],
    ['a correct start still being typed', 'Secr'],
    ['matching', 'Secret1!'],
  ])('shows nothing while the confirmation is %s', (_l, confirm) => {
    const { container, done } = renderWith({ pw: 'Secret1!', pw_confirm: confirm });
    expect(live(container)).toBeNull();
    expect(container.querySelector('.subtleforms-password__confirm').getAttribute('aria-invalid')).toBeNull();
    done();
  });

  test('does not repeat the message once the submit error shows it', () => {
    const { container, done } = renderWith({ pw: 'Secret1!', pw_confirm: 'Sx' }, { pw: 'The passwords do not match.' });
    expect(live(container)).toBeNull();
    expect(container.textContent.match(/The passwords do not match\./g)).toHaveLength(1);
    done();
  });

  test('drops the submit error once the confirmation matches', () => {
    const { container, done } = renderWith({ pw: 'Secret1!', pw_confirm: 'Secret1!' }, { pw: 'The passwords do not match.' });
    expect(container.textContent).not.toContain('The passwords do not match.');
    done();
  });
});

describe('password confirmation inside a repeater (issue 198)', () => {
  const repeater = {
    type: 'repeat_container',
    key: 'people',
    config: { key: 'people', min: 1, max: 3 },
    children: [{ type: 'password', key: 'pw', label: 'Password', requireConfirmation: true }],
  };

  test('the live mismatch shows under the row that has it only', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const values = {
      people: [
        { pw: 'Secret123!', pw_confirm: 'Secret123!' },
        { pw: 'Secret123!', pw_confirm: 'Other' },
      ],
    };
    act(() => {
      root.render(<FieldRenderer field={repeater} values={values} onChange={() => {}} errors={{}} />);
    });
    expect(container.querySelectorAll('.subtleforms-password__confirm')).toHaveLength(2);
    const messages = container.querySelectorAll('.subtleforms-password__mismatch');
    expect(messages).toHaveLength(1);
    expect(messages[0].closest('.subtleforms-repeater__group, fieldset, li').textContent).toContain('Entry 2');
    act(() => root.unmount());
    container.remove();
  });

  test('typing a confirmation writes it into that row', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const onChange = jest.fn();
    act(() => {
      root.render(<FieldRenderer field={repeater} values={{ people: [{ pw: 'a' }] }} onChange={onChange} errors={{}} />);
    });
    const input = container.querySelector('.subtleforms-password__confirm');
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    act(() => {
      set.call(input, 'a');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(onChange).toHaveBeenCalledWith('people.0.pw_confirm', 'a');
    act(() => root.unmount());
    container.remove();
  });
});
