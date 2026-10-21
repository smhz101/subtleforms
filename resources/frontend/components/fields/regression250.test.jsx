/**
 * Tests for fixes that shipped before 2.5.0 without one: Country search
 * on and off (FB-08), the phone country button name (FLD2-08), the
 * calendar month and year jump and locale (FLD2-15), and no label that
 * points at a missing control on choice fields (FB-18).
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';
import CountrySelect from './CountrySelect';
import PhoneField from './PhoneField';
import DateTimeField from './DateTimeField';
import FieldRenderer from '../FieldRenderer';
import { flagMark } from '../../../shared/phone';
import { SAMPLES, buildField } from '../../../../tests/browser/fixtures/fields';

global.IS_REACT_ACT_ENVIRONMENT = true;

beforeAll(() => {
  Element.prototype.scrollIntoView = () => {};
});

afterEach(() => {
  delete window.subtleformsFrontend;
});

function mount(element) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(element));
  return {
    container,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

const click = (el) => act(() => el.click());

describe('Country search on and off (FB-08)', () => {
  test('with search on, opening the list shows a search box', () => {
    const { container, unmount } = mount(
      <CountrySelect inputId='c1' name='c' value='' onChange={() => {}} searchable />
    );
    click(container.querySelector('#c1'));
    expect(container.querySelector('input[type="search"], input[role="combobox"], .subtleforms-picker__search')).not.toBeNull();
    unmount();
  });

  test('with search off, the list opens with no search box', () => {
    const { container, unmount } = mount(
      <CountrySelect inputId='c2' name='c' value='' onChange={() => {}} searchable={false} />
    );
    click(container.querySelector('#c2'));
    expect(container.querySelector('[role="listbox"]')).not.toBeNull();
    expect(container.querySelector('input[type="search"], input[role="combobox"], .subtleforms-picker__search')).toBeNull();
    unmount();
  });
});

describe('phone country button (FLD2-08)', () => {
  test('the button is named with the country and dial code', () => {
    const { container, unmount } = mount(
      <PhoneField inputId='p1' name='p' config={{ countryCodes: true }} value='' onChange={() => {}} />
    );
    const trigger = container.querySelector('.subtleforms-phone__trigger');
    expect(trigger.getAttribute('aria-label')).toMatch(/^Country code, .+ \+\d+$/);
    unmount();
  });

  test('the flag is two letters, not an emoji that Windows browsers cannot draw', () => {
    expect(flagMark('us')).toBe('US');
    expect(flagMark('GB')).toBe('GB');
    expect(flagMark('')).toBe('');
    // eslint-disable-next-line no-control-regex
    expect(/^[A-Z]{0,2}$/.test(flagMark('de'))).toBe(true);
  });

  test('the button shows the two letter mark', () => {
    const { container, unmount } = mount(
      <PhoneField inputId='p2' name='p' config={{ countryCodes: true }} value='' onChange={() => {}} />
    );
    const trigger = container.querySelector('.subtleforms-phone__trigger');
    expect(trigger.textContent).toMatch(/[A-Z]{2}/);
    unmount();
  });
});

describe('calendar month and year jump and locale (FLD2-15)', () => {
  const openDate = (value = '2025-03-31') => {
    const view = mount(
      <DateTimeField mode='date' inputId='d1' name='d' value={value} onChange={() => {}} format='Y-m-d' />
    );
    click(view.container.querySelector('#d1'));
    return view;
  };

  test('the month and year lists jump the calendar', () => {
    const { container, unmount } = openDate();
    const grid = () => container.querySelector('[role="grid"]');
    expect(grid().getAttribute('aria-label')).toMatch(/March 2025/);

    const month = container.querySelector('select.subtleforms-picker__month');
    const year = container.querySelector('select.subtleforms-picker__year');
    expect(month.options).toHaveLength(12);
    // A date of birth is up to 120 years back.
    expect(Number(year.options[0].value)).toBe(2025 - 120);

    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
      setter.call(month, '5');
      month.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(grid().getAttribute('aria-label')).toMatch(/June 2025/);

    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
      setter.call(year, '1990');
      year.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(grid().getAttribute('aria-label')).toMatch(/June 1990/);
    unmount();
  });

  test('month names follow the site language', () => {
    window.subtleformsFrontend = { locale: 'de-DE', weekStartsOn: 1 };
    const { container, unmount } = openDate();
    const names = [...container.querySelectorAll('select.subtleforms-picker__month option')].map((o) => o.textContent);
    expect(names[0]).toBe('Januar');
    expect(names[2]).toBe('März');
    expect(container.querySelector('[role="grid"]').getAttribute('aria-label')).toMatch(/März 2025/);
    unmount();
  });
});

describe('choice fields have no label pointing at a missing control (FB-18)', () => {
  const GROUPS = SAMPLES.filter((s) => ['radio', 'picture_choice'].includes(s.type)
    || (s.type === 'multiple_choice')
    || (s.type === 'checkbox_grid'));

  test.each(GROUPS.map((s) => [s.key || s.type, s]))('%s', (_name, sample) => {
    const field = buildField(sample, '100', 'flat');
    const { container, unmount } = mount(
      <FieldRenderer field={field} values={{}} onChange={() => {}} errors={{}} />
    );
    const labels = [...container.querySelectorAll('label[for]')];
    labels.forEach((label) => {
      const target = label.getAttribute('for');
      expect(container.querySelector(`[id="${target}"]`)).not.toBeNull();
    });
    // The question itself is named for screen readers through the group.
    const group = container.querySelector('[role="radiogroup"], [role="group"], fieldset');
    if (group) {
      expect(group.getAttribute('aria-labelledby') || group.getAttribute('aria-label') || group.querySelector('legend')).toBeTruthy();
    }
    unmount();
  });
});
