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
