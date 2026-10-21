/**
 * FB-24: the builder canvas draws Radio and Checkboxes with their defaults
 * selected, like Dropdown and Toggle already do.
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';
import FieldRenderer from './FieldRenderer';
import { choiceChecked } from '../../../shared/canvasDefaults';

jest.mock('./FieldRenderer.scss', () => ({}));

global.IS_REACT_ACT_ENVIRONMENT = true;

const OPTIONS = [
  { label: 'Red', value: 'red' },
  { label: 'Green', value: 'green' },
  { label: 'Blue', value: 'blue' },
];

function render(field) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(<FieldRenderer field={field} />));
  return { container, unmount: () => act(() => root.unmount()) };
}

const checkedLabels = (container) => (
  [...container.querySelectorAll('input')]
    .filter((input) => input.checked)
    .map((input) => input.closest('.sf-field-renderer__checkbox-wrapper').textContent)
);

describe('canvas choice defaults (FB-24)', () => {
  test('Radio shows its default selected', () => {
    const { container, unmount } = render({ id: 'r', key: 'colour', type: 'radio', label: 'Colour', options: OPTIONS, defaultValue: 'green' });
    expect(checkedLabels(container)).toEqual(['Green']);
    unmount();
  });

  test('Radio with no default shows nothing selected', () => {
    const { container, unmount } = render({ id: 'r', key: 'colour', type: 'radio', label: 'Colour', options: OPTIONS });
    expect(checkedLabels(container)).toEqual([]);
    unmount();
  });

  test('a default read from the field config is shown', () => {
    const { container, unmount } = render({ id: 'r', key: 'colour', type: 'radio', label: 'Colour', options: OPTIONS, config: { defaultValue: 'blue' } });
    expect(checkedLabels(container)).toEqual(['Blue']);
    unmount();
  });

  test('Checkboxes show every default choice', () => {
    const { container, unmount } = render({ id: 'm', key: 'pick', type: 'multiple_choice', label: 'Pick', options: OPTIONS, defaultValue: 'red, blue' });
    expect(checkedLabels(container)).toEqual(['Red', 'Blue']);
    unmount();
  });

  test('Checkboxes that allow one choice check only the first default', () => {
    const { container, unmount } = render({ id: 'm', key: 'pick', type: 'multiple_choice', label: 'Pick', options: OPTIONS, allowMultiple: false, defaultValue: 'red,blue' });
    expect(checkedLabels(container)).toEqual(['Red']);
    unmount();
  });

  test('choiceChecked checks a single list once', () => {
    expect(choiceChecked(OPTIONS, 'red,blue', 0, true)).toBe(true);
    expect(choiceChecked(OPTIONS, 'red,blue', 2, true)).toBe(false);
    expect(choiceChecked(OPTIONS, 'red,blue', 2, false)).toBe(true);
    expect(choiceChecked(OPTIONS, '', 0, false)).toBe(false);
  });
});
